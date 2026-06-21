// Fetches and parses RSS feeds, normalizes items into a single article shape,
// merges across sources, dedupes, and sorts newest-first.

import Parser from "rss-parser";
import { Cache } from "./cache.js";
import { feedsForTopics, feedsForDomain, publisherInfo } from "./feeds.js";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "TheBrief/1.0 (+news aggregator)" },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail"],
      ["content:encoded", "contentEncoded"],
    ],
  },
});

// Parsed-feed cache — feeds don't change more than every few minutes.
const feedCache = new Cache({ ttl: 5 * 60 * 1000 });

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

// Decode HTML entities — both numeric (&#8217; &#x2019;) and the common named ones.
function decodeEntities(text = "") {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function safeCodePoint(cp) {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

function stripHtml(html = "") {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

// Try hard to find a representative image for an item.
function extractImage(item) {
  if (item.enclosure?.url && /^image|\.(jpg|jpeg|png|webp|gif)/i.test(item.enclosure.type || item.enclosure.url)) {
    return item.enclosure.url;
  }
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (Array.isArray(item.mediaContent)) {
    const img = item.mediaContent.find((m) => m?.$?.url && /image/i.test(m?.$?.medium || m?.$?.type || "image"));
    if (img) return img.$.url;
  }
  // RSS <image><url> or media:group entries.
  if (item.image?.url) return item.image.url;
  if (item["media:group"]?.["media:content"]) {
    const mc = item["media:group"]["media:content"];
    const arr = Array.isArray(mc) ? mc : [mc];
    const img = arr.find((m) => m?.$?.url);
    if (img) return img.$.url;
  }
  // First <img> found in any HTML-bearing field (content or description/summary).
  const html =
    item.contentEncoded || item["content:encoded"] || item.content || item.summary || item.description || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];
  // og:image-style media in the raw item as a last resort.
  if (item.mediaThumbnail?.url) return item.mediaThumbnail.url;
  return null;
}

function normalizeItem(item, feedMeta) {
  const snippetSource = item.contentSnippet || item.summary || stripHtml(item.content || "");
  return {
    id: item.guid || item.link,
    title: decodeEntities((item.title || "").trim()),
    url: item.link,
    source: feedMeta.source,
    domain: feedMeta.domain || null,
    paywalled: Boolean(feedMeta.paywalled),
    topicId: feedMeta.topicId,
    topicLabel: feedMeta.topicLabel,
    publishedAt: item.isoDate || item.pubDate || null,
    snippet: stripHtml(snippetSource).slice(0, 400),
    image: extractImage(item),
  };
}

async function fetchFeed(feedMeta) {
  const cached = feedCache.get(feedMeta.url);
  if (cached) return cached.map((i) => ({ ...i, topicId: feedMeta.topicId, topicLabel: feedMeta.topicLabel }));

  try {
    const parsed = await parser.parseURL(feedMeta.url);
    const items = (parsed.items || [])
      .filter((it) => it.title && it.link)
      .slice(0, 30)
      .map((it) => normalizeItem(it, feedMeta));
    feedCache.set(feedMeta.url, items);
    return items;
  } catch (err) {
    console.warn(`[aggregate] failed ${feedMeta.source} (${feedMeta.url}): ${err.message}`);
    return [];
  }
}

// Merge feed results, deduping by URL and near-identical headline.
function mergeResults(results) {
  const seen = new Set();
  const articles = [];
  let errors = 0;

  for (const r of results) {
    if (r.status !== "fulfilled") {
      errors++;
      continue;
    }
    for (const article of r.value) {
      const key = article.url || article.id;
      if (!key || seen.has(key)) continue;
      const titleKey = article.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
      if (titleKey && seen.has(titleKey)) continue;
      seen.add(key);
      if (titleKey) seen.add(titleKey);
      articles.push(article);
    }
  }
  return { articles, errors };
}

/**
 * Aggregate all feeds for the given topic ids into a balanced, merged list.
 * @param {string[]} topicIds
 * @returns {Promise<{articles: object[], errors: number}>}
 */
export async function aggregate(topicIds) {
  const feeds = feedsForTopics(topicIds);
  if (feeds.length === 0) return { articles: [], errors: 0 };

  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const { articles, errors } = mergeResults(results);
  return { articles: balancedInterleave(articles), errors };
}

/**
 * All articles from a single publisher (across every topic/section), newest-first —
 * the in-app equivalent of visiting their homepage.
 * @param {string} domain
 */
export async function aggregatePublisher(domain) {
  const feeds = feedsForDomain(domain);
  if (feeds.length === 0) return { publisher: publisherInfo(domain), articles: [], errors: 0 };

  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const { articles, errors } = mergeResults(results);
  articles.sort((a, b) => recency(b) - recency(a));
  return { publisher: publisherInfo(domain), articles, errors };
}

function recency(a) {
  return a && a.publishedAt ? Date.parse(a.publishedAt) : 0;
}

// Round-robin a pre-ordered list into key-balanced order (one per group per round).
function interleaveBy(list, keyFn) {
  const groups = new Map();
  for (const item of list) {
    const k = keyFn(item);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(item);
  }
  const lists = [...groups.values()];
  const out = [];
  for (let i = 0; out.length < list.length; i++) {
    let any = false;
    for (const l of lists) {
      if (l.length > i) {
        out.push(l[i]);
        any = true;
      }
    }
    if (!any) break;
  }
  return out;
}

// Build a balanced "All" feed: even rotation across topics, and within each topic
// even rotation across sources — so the top of the feed isn't dominated by whichever
// topic or publisher happened to post a burst. Each group stays recency-ordered, and
// topics are seeded by their freshest item so the very top is still genuinely recent.
// (Single-topic views re-sort by recency client-side, so this only shapes "All".)
function balancedInterleave(articles) {
  const byTopic = new Map();
  for (const a of articles) {
    if (!byTopic.has(a.topicId)) byTopic.set(a.topicId, []);
    byTopic.get(a.topicId).push(a);
  }

  const topicStreams = [];
  for (const list of byTopic.values()) {
    list.sort((a, b) => recency(b) - recency(a));
    topicStreams.push(interleaveBy(list, (a) => a.source));
  }
  topicStreams.sort((a, b) => recency(b[0]) - recency(a[0]));

  const out = [];
  for (let i = 0; out.length < articles.length; i++) {
    let any = false;
    for (const s of topicStreams) {
      if (s.length > i) {
        out.push(s[i]);
        any = true;
      }
    }
    if (!any) break;
  }
  return out;
}
