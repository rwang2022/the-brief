// Shared LLM plumbing — provider selection + a single `callLLM(prompt, system)`
// entry point used by both summarize.js (one-sentence summaries + curator scores)
// and edition.js.
//
// Pick a provider via SUMMARY_PROVIDER, or it auto-detects from whatever you've
// configured (first match wins):
//   • gemini    — Google Gemini free tier   (GEMINI_API_KEY)   ← easiest free, no card
//   • groq      — Groq free tier             (GROQ_API_KEY)     ← free, very fast
//   • ollama    — local model, 100% free     (OLLAMA_MODEL / OLLAMA_HOST)
//   • anthropic — Claude (paid, pennies)     (ANTHROPIC_API_KEY)
//   • none      — no key set → callers fall back to non-AI behaviour

import Anthropic from "@anthropic-ai/sdk";

// Detected lazily (on each call) from process.env — important because .env is
// loaded after this module is imported, so we must NOT cache at import time.
export function detectProvider() {
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

export async function fetchJson(url, options, timeout = 20000) {
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

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

let anthropicClient = null;

// Send one prompt to the active provider; returns raw text (callers parse JSON).
export async function callLLM(userPrompt, system) {
  switch (detectProvider()) {
    case "gemini": {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const data = await fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 2048 },
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
            { role: "system", content: system },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 2048,
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
              { role: "system", content: system },
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
        max_tokens: 2048,
        system,
        messages: [{ role: "user", content: userPrompt }],
      });
      return res.content.find((b) => b.type === "text")?.text || "";
    }
    default:
      return "";
  }
}
