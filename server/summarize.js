// One-sentence AI summaries + curator scores — one LLM call does both.
//
// The same batched provider call that writes a story's one-sentence brief also
// returns a newsworthiness score (0-100) and a junk flag, so the feed's curator
// costs no extra round-trips (see server/curate.js for the no-AI heuristic layer
// and server/index.js for how the feed uses `?curated=1`).
//
// Results are cached on disk by article URL — summaries in summaries.json,
// scores in curation.json — so a story is only ever processed once.

import { Cache } from "./cache.js";
import { callLLM, chunk, detectProvider } from "./llm.js";

// Re-exported so existing importers (server/index.js) don't need to change.
export { summariesConfigured, summaryProvider } from "./llm.js";

const summaryCache = new Cache({ ttl: 24 * 60 * 60 * 1000, persistTo: "summaries.json" });
const curationCache = new Cache({ ttl: 24 * 60 * 60 * 1000, persistTo: "curation.json" });

const SYSTEM = `You are the editor of a mobile news app called "The Brief". For each article you receive a headline, source and a short context snippet. Return, per article:
- "summary": exactly ONE sentence, under 30 words, capturing the single most important fact — the "so what". Neutral and factual: no editorializing, no clickbait, no trailing ellipsis. Do not start with "This article" or "The article"; lead with the news.
- "score": an integer 0-100 for how newsworthy and substantive this is for a general reader. High (70-100): consequential reporting on world/national events, politics, business, science, notable culture. Medium (40-69): solid but narrower stories. Low (0-39): thin aggregation, celebrity gossip, opinion/hot-takes, service pieces, listicles.
- "junk": true if this is NOT real news — sponsored/affiliate content, product-deal roundups, coupon posts, horoscopes, "Wordle answer", pure PR, or SEO filler. Otherwise false.`;

// ---- batching + parsing ---------------------------------------------------

// Lenient JSON extraction — strips code fences and tolerates {summaries:[...]} or a bare array.
function parseBatch(text, batch) {
  const summaries = {};
  const curation = {};
  if (!text) return { summaries, curation };
  let cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (!m) return { summaries, curation };
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return { summaries, curation };
    }
  }
  const list = Array.isArray(parsed) ? parsed : parsed.summaries || parsed.results || parsed.articles || [];
  for (const item of list) {
    if (!item) continue;
    const idx = typeof item.index === "number" ? item.index : list.indexOf(item);
    const article = batch[idx];
    if (!article) continue;
    const summary = (item.summary || item.text || "").trim();
    if (summary) summaries[article.url] = summary;
    const score = clampScore(item.score);
    const junk = item.junk === true || item.junk === "true";
    if (score !== null || junk) curation[article.url] = { score: score ?? 50, junk };
  }
  return { summaries, curation };
}

function clampScore(v) {
  const n = typeof v === "number" ? v : parseInt(v, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

async function processBatch(batch) {
  const payload = batch
    .map((a, i) => `[${i}] HEADLINE: ${a.title}\nSOURCE: ${a.source}\nCONTEXT: ${(a.snippet || "").slice(0, 280)}`)
    .join("\n\n");

  const prompt = `Process each of these ${batch.length} articles.
Return ONLY JSON of the form {"summaries":[{"index":0,"summary":"...","score":0,"junk":false}]}, with one entry per index.

${payload}`;

  try {
    const text = await callLLM(prompt, SYSTEM);
    return parseBatch(text, batch);
  } catch (err) {
    console.warn(`[summarize] ${detectProvider()} batch failed:`, err.message);
    return { summaries: {}, curation: {} };
  }
}

/**
 * Summarize + score a list of articles, using the caches where possible.
 * @param {{url:string,title:string,source:string,snippet?:string}[]} articles
 * @returns {Promise<{summaries: Record<string,string>, curation: Record<string,{score:number,junk:boolean}>}>}
 */
export async function summarizeAndScore(articles) {
  const summaries = {};
  const curation = {};
  const todo = [];

  for (const a of articles) {
    if (!a?.url || !a?.title) continue;
    const cachedSummary = summaryCache.get(a.url);
    const cachedCuration = curationCache.get(a.url);
    if (cachedSummary) summaries[a.url] = cachedSummary;
    if (cachedCuration) curation[a.url] = cachedCuration;
    if (!cachedSummary || !cachedCuration) todo.push(a);
  }

  if (todo.length === 0 || detectProvider() === "none") return { summaries, curation };

  const batches = chunk(todo, 8);
  const settled = await Promise.allSettled(batches.map(processBatch));

  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const [url, summary] of Object.entries(s.value.summaries)) {
      summaries[url] = summary;
      summaryCache.set(url, summary);
    }
    for (const [url, c] of Object.entries(s.value.curation)) {
      curation[url] = c;
      curationCache.set(url, c);
    }
  }

  return { summaries, curation };
}

/**
 * Summaries only — thin wrapper for callers that don't need curator scores.
 * @returns {Promise<Record<string,string>>}  url -> summary
 */
export async function summarize(articles) {
  const { summaries } = await summarizeAndScore(articles);
  return summaries;
}
