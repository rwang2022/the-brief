// The no-AI curator layer: runs synchronously on every `?curated=1` feed request
// so it adds zero latency. It drops obvious junk (sponsored / affiliate / deal
// roundups / horoscopes / Wordle), collapses near-duplicate stories, and gently
// re-orders so corroborated stories (same news from 2+ outlets) rise — while
// recency still dominates the top of the feed.
//
// The AI score/junk flag from server/summarize.js refines this further on the
// client as summaries stream in.

import { recency } from "./aggregate.js";

const JUNK_PATTERNS = [
  /\bsponsored\b/i,
  /\bpaid post\b/i,
  /\bpartner content\b/i,
  /\badvertorial\b/i,
  /\bpromo code\b/i,
  /\bcoupon(s)?\b/i,
  /\b(best|top)\s+\d+\b.*\b(deals?|gifts?|products?|gadgets?)\b/i,
  /\bdeal of the day\b/i,
  /\b(prime day|black friday|cyber monday)\b.*\bdeal/i,
  /\bwordle\b.*\b(answer|hint|solution)\b/i,
  /\b(today'?s )?connections\b.*\b(answer|hint)\b/i,
  /\bhoroscope\b/i,
  /\bzodiac\b.*\b(sign|today)\b/i,
];

function isJunk(article) {
  const hay = `${article.title || ""} ${article.snippet || ""}`;
  return JUNK_PATTERNS.some((re) => re.test(hay));
}

const STOPWORDS = new Set(
  "the a an and or of to in on for with at by from as is are was were be been it its this that these those new say says said after over into amid vs".split(
    " "
  )
);

// Significant lowercase tokens of a headline, for similarity clustering.
function tokens(title = "") {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function sharedCount(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter;
}

// Two headlines are "the same story" if they overlap heavily proportionally, OR
// share several distinctive words (catches reworded wire copy like
// "5 dead in Amazon cargo plane crash" vs "Five killed as Amazon plane overshoots runway").
function sameStory(a, b) {
  if (!a.size || !b.size) return false;
  const inter = sharedCount(a, b);
  const jac = inter / (a.size + b.size - inter);
  return jac >= 0.5 || inter >= 4;
}

/**
 * @param {object[]} articles  aggregated pool (already deduped by URL/title)
 * @returns {{articles: object[], hidden: number}}
 */
export function curateHeuristic(articles) {
  const live = articles.filter((a) => a && a.title);
  const kept = [];
  let hidden = 0;

  // Pass 1: drop junk.
  const notJunk = [];
  for (const a of live) {
    if (isJunk(a)) hidden++;
    else notJunk.push(a);
  }

  // Pass 2: cluster near-duplicate headlines; keep the newest of each cluster,
  // and mark it corroborated when 2+ distinct domains carried the story.
  const clusters = []; // { tokenSet, members: [] }
  for (const a of notJunk) {
    const ts = new Set(tokens(a.title));
    let hit = null;
    for (const c of clusters) {
      if (sameStory(ts, c.tokenSet)) {
        hit = c;
        break;
      }
    }
    if (hit) hit.members.push(a);
    else clusters.push({ tokenSet: ts, members: [a] });
  }

  for (const c of clusters) {
    c.members.sort((x, y) => recency(y) - recency(x));
    const winner = c.members[0];
    const domains = new Set(c.members.map((m) => m.domain).filter(Boolean));
    winner.corroborated = domains.size >= 2;
    winner.alsoReportedBy = c.members.length - 1;
    kept.push(winner);
    hidden += c.members.length - 1;
  }

  // Pass 3: blended re-order — recency dominates, corroboration nudges up.
  const times = kept.map(recency).filter(Boolean);
  const newest = Math.max(...times, Date.now());
  const oldest = Math.min(...times, newest - 1);
  const span = Math.max(1, newest - oldest);
  for (const a of kept) {
    const recencyNorm = (recency(a) - oldest) / span; // 0..1
    a._rank = 0.62 * recencyNorm + 0.38 * (a.corroborated ? 1 : 0);
  }
  kept.sort((x, y) => y._rank - x._rank);
  for (const a of kept) delete a._rank;

  return { articles: kept, hidden };
}
