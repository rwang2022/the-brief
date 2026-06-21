// One-sentence AI summaries — provider-pluggable, with FREE options.
//
// Pick a provider via SUMMARY_PROVIDER, or it auto-detects from whatever you've
// configured (first match wins):
//   • gemini    — Google Gemini free tier   (GEMINI_API_KEY)   ← easiest free, no card
//   • groq      — Groq free tier             (GROQ_API_KEY)     ← free, very fast
//   • ollama    — local model, 100% free     (OLLAMA_MODEL / OLLAMA_HOST)
//   • anthropic — Claude (paid, pennies)     (ANTHROPIC_API_KEY)
//   • none      — no key set → feed falls back to RSS snippets
//
// All providers are asked for the same JSON shape; results are cached on disk by
// article URL so a story is only ever summarized once.

import Anthropic from "@anthropic-ai/sdk";
import { Cache } from "./cache.js";

const summaryCache = new Cache({ ttl: 24 * 60 * 60 * 1000, persistTo: "summaries.json" });

const SYSTEM = `You write one-sentence summaries of news articles for a mobile news app called "The Brief".
Rules:
- Exactly ONE sentence, under 30 words.
- Capture the single most important fact or development — the "so what".
- Neutral, factual tone. No editorializing, no clickbait, no trailing ellipsis.
- Do not start with "This article" or "The article". Lead with the news itself.`;

// ---- provider selection ---------------------------------------------------

// Detected lazily (on each call) from process.env — important because .env is
// loaded after this module is imported, so we must NOT cache at import time.
function detectProvider() {
  const explicit = (process.env.SUMMARY_PROVIDER || "").toLowerCase();
  if (explicit) return explicit;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OLLAMA_MODEL || process.env.OLLAMA_HOST) return "ollama";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "none";
}

export function summaryProvider() {
  return detectProvider();
}
export function summariesConfigured() {
  return detectProvider() !== "none";
}

// ---- per-provider callers (return raw text) -------------------------------

async function fetchJson(url, options, timeout = 20000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

let anthropicClient = null;

async function callLLM(userPrompt) {
  switch (detectProvider()) {
    case "gemini": {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const data = await fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 1024 },
        }),
      });
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    case "groq": {
      const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      const data = await fetchJson("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 1024,
        }),
      });
      return data?.choices?.[0]?.message?.content || "";
    }
    case "ollama": {
      const host = process.env.OLLAMA_HOST || "http://localhost:11434";
      const model = process.env.OLLAMA_MODEL || "llama3.2";
      const data = await fetchJson(
        `${host.replace(/\/$/, "")}/api/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: userPrompt },
            ],
            format: "json",
            stream: false,
            options: { temperature: 0.2 },
          }),
        },
        60000 // local models can be slower
      );
      return data?.message?.content || "";
    }
    case "anthropic": {
      if (!anthropicClient) anthropicClient = new Anthropic();
      const res = await anthropicClient.messages.create({
        model: process.env.BRIEF_MODEL || "claude-haiku-4-5",
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      });
      return res.content.find((b) => b.type === "text")?.text || "";
    }
    default:
      return "";
  }
}

// ---- batching + parsing ---------------------------------------------------

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Lenient JSON extraction — strips code fences and tolerates {summaries:[...]} or a bare array.
function parseSummaries(text, batch) {
  const out = {};
  if (!text) return out;
  let cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (!m) return out;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      return out;
    }
  }
  const list = Array.isArray(parsed) ? parsed : parsed.summaries || parsed.results || [];
  for (const item of list) {
    if (!item) continue;
    const idx = typeof item.index === "number" ? item.index : list.indexOf(item);
    const article = batch[idx];
    const summary = (item.summary || item.text || "").trim();
    if (article && summary) out[article.url] = summary;
  }
  return out;
}

async function summarizeBatch(batch) {
  const payload = batch
    .map((a, i) => `[${i}] HEADLINE: ${a.title}\nSOURCE: ${a.source}\nCONTEXT: ${(a.snippet || "").slice(0, 280)}`)
    .join("\n\n");

  const prompt = `Summarize each of these ${batch.length} articles in one sentence.
Return ONLY JSON of the form {"summaries":[{"index":0,"summary":"..."}]}, with one entry per index.

${payload}`;

  try {
    const text = await callLLM(prompt);
    return parseSummaries(text, batch);
  } catch (err) {
    console.warn(`[summarize] ${detectProvider()} batch failed:`, err.message);
    return {};
  }
}

/**
 * Summarize a list of articles, using the cache where possible.
 * @param {{url:string,title:string,source:string,snippet?:string}[]} articles
 * @returns {Promise<Record<string,string>>}  url -> summary
 */
export async function summarize(articles) {
  const result = {};
  const todo = [];

  for (const a of articles) {
    if (!a?.url || !a?.title) continue;
    const cached = summaryCache.get(a.url);
    if (cached) result[a.url] = cached;
    else todo.push(a);
  }

  if (todo.length === 0 || detectProvider() === "none") return result;

  const batches = chunk(todo, 8);
  const settled = await Promise.allSettled(batches.map(summarizeBatch));

  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    for (const [url, summary] of Object.entries(s.value)) {
      result[url] = summary;
      summaryCache.set(url, summary);
    }
  }

  return result;
}
