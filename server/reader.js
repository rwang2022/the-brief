// Clean reader mode + paywall-bypass fallback chain.
//
// Strategy for a given article URL:
//   1. Fetch the page directly and run Mozilla Readability.
//   2. If the result looks paywalled/truncated, refetch via removepaywalls.com.
//   3. If that still looks thin, refetch via 12ft.io.
//   The first result that yields a substantial, clean article wins.
//
// Note: the public bypass services are best-effort and frequently rate-limit or go
// down — this chain degrades gracefully and always returns the best result it got.

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { Cache } from "./cache.js";

const readerCache = new Cache({ ttl: 6 * 60 * 60 * 1000, persistTo: "reader.json" });

// A desktop browser UA helps a lot of sites serve full content.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const MIN_GOOD_LENGTH = 1200; // chars of article text below which we suspect a paywall/stub

// Phrases that strongly suggest we hit a paywall/registration wall.
const PAYWALL_HINTS = [
  "subscribe to continue",
  "subscribe to read",
  "create a free account",
  "already a subscriber",
  "this content is for subscribers",
  "to continue reading",
  "sign in to read",
  "for unlimited access",
];

async function fetchHtml(url, opts = {}) {
  const { timeout = 15000 } = opts;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(opts.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!opts.acceptAny) {
      const ctype = res.headers.get("content-type") || "";
      if (!ctype.includes("html") && !ctype.includes("xml")) throw new Error(`non-html (${ctype})`);
    }
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// Parse HTML into a clean article via Readability.
function parseArticle(html, url) {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article) return null;
  return {
    title: article.title,
    byline: article.byline || null,
    content: article.content, // sanitized HTML
    text: article.textContent || "",
    length: (article.textContent || "").trim().length,
    excerpt: article.excerpt || null,
    siteName: article.siteName || null,
  };
}

function looksPaywalled(article) {
  if (!article) return true;
  if (article.length < MIN_GOOD_LENGTH) return true;
  const lower = (article.text || "").toLowerCase();
  return PAYWALL_HINTS.some((h) => lower.includes(h));
}

// Paywall-bypass proxies, in order of effectiveness for hard paywalls.
function archiveTodayUrl(url) {
  // archive.today keeps full-text snapshots of paywalled articles.
  return `https://archive.ph/newest/${url}`;
}
function removePaywallsUrl(url) {
  return `https://removepaywalls.com/${url}`;
}
function twelveFtUrl(url) {
  return `https://12ft.io/proxy?q=${encodeURIComponent(url)}`;
}

// Jina Reader renders the page server-side (executing JS) and returns clean HTML.
// Anonymous access is blocked for hard-walled domains, but a (free) API key is
// allowed — so this strategy only runs when JINA_API_KEY is set.
const JINA_KEY = process.env.JINA_API_KEY;
async function tryJina(articleUrl) {
  if (!JINA_KEY) return null;
  try {
    const html = await fetchHtml(`https://r.jina.ai/${articleUrl}`, {
      timeout: 30000,
      acceptAny: true,
      headers: { Authorization: `Bearer ${JINA_KEY}`, "X-Return-Format": "html" },
    });
    const article = parseArticle(html, articleUrl);
    if (article && article.length > 200) return { ...article, strategy: "jina" };
  } catch (err) {
    console.warn(`[reader] jina failed for ${articleUrl}: ${err.message}`);
  }
  return null;
}

async function tryStrategy(label, fetchUrl, articleUrl, opts = {}) {
  try {
    const html = await fetchHtml(fetchUrl, opts);
    const article = parseArticle(html, articleUrl);
    if (article && article.length > 200) {
      return { ...article, strategy: label };
    }
  } catch (err) {
    console.warn(`[reader] ${label} failed for ${articleUrl}: ${err.message}`);
  }
  return null;
}

/**
 * Get clean reader-mode content for an article, bypassing paywalls when needed.
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function getReader(url) {
  const cached = readerCache.get(url);
  if (cached) return cached;

  let best = null;

  // 1) Direct fetch.
  const direct = await tryStrategy("direct", url, url);
  if (direct) best = direct;

  // 2) Jina Reader (authenticated) — renders JS server-side; best shot at hard walls.
  if (looksPaywalled(best)) {
    const jn = await tryJina(url);
    if (jn && (!best || jn.length > best.length)) best = jn;
  }

  // 3) archive.today — good on hard paywalls when not rate-limited.
  if (looksPaywalled(best)) {
    const az = await tryStrategy("archive.today", archiveTodayUrl(url), url, { timeout: 20000 });
    if (az && (!best || az.length > best.length)) best = az;
  }

  // 3) removepaywalls.com.
  if (looksPaywalled(best)) {
    const rp = await tryStrategy("removepaywalls", removePaywallsUrl(url), url);
    if (rp && (!best || rp.length > best.length)) best = rp;
  }

  // 4) 12ft.io as a final fallback.
  if (looksPaywalled(best)) {
    const tf = await tryStrategy("12ft", twelveFtUrl(url), url);
    if (tf && (!best || tf.length > best.length)) best = tf;
  }

  if (!best) {
    const err = {
      ok: false,
      url,
      error: "Could not extract a readable version of this article.",
    };
    return err;
  }

  const payload = {
    ok: true,
    url,
    title: best.title,
    byline: best.byline,
    siteName: best.siteName,
    content: best.content,
    excerpt: best.excerpt,
    strategy: best.strategy,
    bypassed: best.strategy !== "direct",
    wordCount: best.text.trim().split(/\s+/).filter(Boolean).length,
  };

  // Only cache genuinely good extractions.
  if (best.length >= 600) readerCache.set(url, payload);
  return payload;
}
