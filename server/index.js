// The Brief — Express backend.
// Endpoints:
//   GET  /api/topics                       -> topic catalog for onboarding
//   GET  /api/feed?topics=tech,world       -> merged, sorted articles (with cached summaries inlined)
//   POST /api/summarize { articles:[...] } -> { url: summary } (generates + caches)
//   GET  /api/article?url=...              -> clean reader-mode content (with paywall bypass)
//   GET  /api/health

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import compression from "compression";

import { TOPICS, topicCatalog } from "./feeds.js";
import { aggregate, aggregatePublisher } from "./aggregate.js";
import { summarize, summariesConfigured, summaryProvider } from "./summarize.js";
import { getReader } from "./reader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env (zero-dependency parse — avoids pulling in dotenv).
async function loadEnv() {
  try {
    const raw = await readFile(join(__dirname, "..", ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // No .env file — rely on real environment variables.
  }
}
await loadEnv();

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, summaries: summariesConfigured(), provider: summaryProvider() });
});

app.get("/api/topics", (_req, res) => {
  // Includes each topic's source list (name, domain, paywalled) for the
  // onboarding picker and the About → "Sources" list.
  res.json({ topics: topicCatalog() });
});

app.get("/api/feed", async (req, res) => {
  const topics = String(req.query.topics || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (topics.length === 0) {
    return res.status(400).json({ error: "Provide at least one topic, e.g. ?topics=tech,world" });
  }

  try {
    const { articles, errors } = await aggregate(topics);

    // The feed loads fast with no AI calls; the client lazily requests summaries
    // for visible cards via POST /api/summarize (cached server-side).
    res.json({
      articles,
      count: articles.length,
      feedErrors: errors,
      summariesEnabled: summariesConfigured(),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[feed] error:", err);
    res.status(500).json({ error: "Failed to load feed." });
  }
});

app.get("/api/publisher", async (req, res) => {
  const domain = String(req.query.domain || "").trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return res.status(400).json({ error: "A valid publisher domain is required." });
  }
  try {
    const data = await aggregatePublisher(domain);
    res.json(data);
  } catch (err) {
    console.error("[publisher] error:", err);
    res.status(500).json({ error: "Failed to load publisher." });
  }
});

app.post("/api/summarize", async (req, res) => {
  const articles = Array.isArray(req.body?.articles) ? req.body.articles : [];
  if (articles.length === 0) return res.json({ summaries: {} });
  try {
    // Cap per request to keep latency and cost bounded.
    const summaries = await summarize(articles.slice(0, 40));
    res.json({ summaries, enabled: summariesConfigured() });
  } catch (err) {
    console.error("[summarize] error:", err);
    res.status(500).json({ error: "Failed to summarize." });
  }
});

app.get("/api/article", async (req, res) => {
  const url = String(req.query.url || "");
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "A valid http(s) url is required." });
  }
  try {
    const article = await getReader(url);
    res.json(article);
  } catch (err) {
    console.error("[article] error:", err);
    res.status(500).json({ ok: false, error: "Failed to load article." });
  }
});

// Serve the built frontend in production (after `npm run build`).
app.use(express.static(join(__dirname, "..", "dist")));
app.get("*", (_req, res, next) => {
  const indexPath = join(__dirname, "..", "dist", "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n  The Brief API → http://localhost:${PORT}`);
  console.log(
    `  Summaries: ${summariesConfigured() ? `enabled via ${summaryProvider()}` : "off (RSS snippets) — set GEMINI_API_KEY for free AI"}\n`
  );
});
