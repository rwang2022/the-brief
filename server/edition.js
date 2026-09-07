// "The Edition" — a balanced daily top-N with full article text baked in, for
// fully-offline reading on a commute. Aggregates the chosen topics, runs the
// curator (heuristic + AI score), picks a spread across topics/publishers, then
// pre-fetches each pick's clean reader content. The whole bundle is cached on
// disk for the day so re-downloads the same morning are instant and free.

import { Cache } from "./cache.js";
import { aggregate, recency } from "./aggregate.js";
import { curateHeuristic } from "./curate.js";
import { summarizeAndScore } from "./summarize.js";
import { getReader } from "./reader.js";

const editionCache = new Cache({ ttl: 12 * 60 * 60 * 1000, persistTo: "edition.json" });

const SCORE_CANDIDATES = 100; // how many top heuristic picks to send for AI scoring
const READER_CONCURRENCY = 5;

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Run `worker` over `items` with a fixed concurrency.
async function pool(items, concurrency, worker) {
  const results = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

// Pick `n` articles spread across topics (<=perTopic) and publishers (<=perPub),
// walking a pre-ranked list and relaxing the caps if we come up short.
function balancedPick(ranked, n, perTopic = 3, perPub = 2) {
  const chosen = [];
  const pickWith = (tCap, pCap) => {
    const tCount = new Map();
    const pCount = new Map();
    for (const a of chosen) {
      tCount.set(a.topicId, (tCount.get(a.topicId) || 0) + 1);
      pCount.set(a.domain, (pCount.get(a.domain) || 0) + 1);
    }
    for (const a of ranked) {
      if (chosen.includes(a)) continue;
      if ((tCount.get(a.topicId) || 0) >= tCap) continue;
      if (a.domain && (pCount.get(a.domain) || 0) >= pCap) continue;
      chosen.push(a);
      tCount.set(a.topicId, (tCount.get(a.topicId) || 0) + 1);
      pCount.set(a.domain, (pCount.get(a.domain) || 0) + 1);
      if (chosen.length >= n) return;
    }
  };
  pickWith(perTopic, perPub);
  if (chosen.length < n) pickWith(perTopic + 2, perPub + 1);
  if (chosen.length < n) pickWith(Infinity, Infinity);
  return chosen.slice(0, n);
}

// From a wider, rank-ordered pool whose reader content is already fetched, take
// the final `n` — keeping the topic/publisher spread and preferring stories we
// can actually read offline (reader !== null) before falling back to stubs.
function finalSelect(wide, n, perTopic = 3, perPub = 2) {
  const chosen = [];
  const tCount = new Map();
  const pCount = new Map();
  const fits = (a, tCap, pCap) =>
    (tCount.get(a.topicId) || 0) < tCap && (!a.domain || (pCount.get(a.domain) || 0) < pCap);
  const take = (a) => {
    chosen.push(a);
    tCount.set(a.topicId, (tCount.get(a.topicId) || 0) + 1);
    if (a.domain) pCount.set(a.domain, (pCount.get(a.domain) || 0) + 1);
  };
  for (const a of wide) {
    if (chosen.length >= n) break;
    if (a.reader && fits(a, perTopic, perPub)) take(a);
  }
  for (const a of wide) {
    if (chosen.length >= n) break;
    if (!chosen.includes(a) && fits(a, perTopic + 2, perPub + 1)) take(a);
  }
  for (const a of wide) {
    if (chosen.length >= n) break;
    if (!chosen.includes(a)) take(a);
  }
  return chosen.slice(0, n);
}

/**
 * @param {string[]} topicIds
 * @param {number} n
 * @returns {Promise<{date:string,generatedAt:string,count:number,articles:object[]}>}
 */
export async function buildEdition(topicIds, n = 15) {
  const key = `${[...topicIds].sort().join(",")}|${n}|${today()}`;
  const cached = editionCache.get(key);
  if (cached) return cached;

  const { articles: raw } = await aggregate(topicIds);
  const { articles: curated } = curateHeuristic(raw);

  // Score the strongest candidates (already recency+corroboration ordered).
  const candidates = curated.slice(0, SCORE_CANDIDATES);
  const { summaries, curation } = await summarizeAndScore(candidates);

  const times = candidates.map(recency).filter(Boolean);
  const newest = Math.max(...times, Date.now());
  const oldest = Math.min(...times, newest - 1);
  const span = Math.max(1, newest - oldest);

  const ranked = candidates
    .map((a) => {
      const c = curation[a.url] || {};
      const recencyNorm = (recency(a) - oldest) / span;
      const scoreNorm = (typeof c.score === "number" ? c.score : 55) / 100;
      return {
        ...a,
        summary: summaries[a.url] || a.snippet || "",
        score: typeof c.score === "number" ? c.score : null,
        junk: c.junk === true,
        _rank: 0.45 * recencyNorm + 0.45 * scoreNorm + 0.1 * (a.corroborated ? 1 : 0),
      };
    })
    .filter((a) => !a.junk && (a.score === null || a.score >= 30))
    .sort((x, y) => y._rank - x._rank);

  // Over-pick a wide, balanced pool; we'll fetch readers for all of it and then
  // narrow to n, keeping the spread and preferring offline-readable stories.
  const wide = balancedPick(ranked, Math.min(ranked.length, n * 2));

  // Pre-fetch clean reader content for each candidate (getReader is cached 6h).
  const fetched = await pool(wide, READER_CONCURRENCY, async (a) => {
    let reader = null;
    try {
      const r = await getReader(a.url);
      if (r && r.ok) {
        reader = {
          title: r.title,
          byline: r.byline,
          siteName: r.siteName,
          content: r.content,
          excerpt: r.excerpt,
          strategy: r.strategy,
          bypassed: r.bypassed,
          wordCount: r.wordCount,
        };
      }
    } catch {
      /* leave reader null — the row still opens online */
    }
    const { _rank, ...clean } = a;
    return { ...clean, reader };
  });

  const withReader = finalSelect(fetched, n);

  const edition = {
    date: today(),
    generatedAt: new Date().toISOString(),
    count: withReader.length,
    articles: withReader,
  };
  editionCache.set(key, edition);
  return edition;
}
