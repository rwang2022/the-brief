# The Brief 📰

A mobile-first, iOS-style news aggregator. Pick your topics, get the day's headlines from free RSS feeds with a one-sentence AI summary each, and tap any story to read it in a clean native reader — with automatic paywall bypass.

> **Apple News meets iMessage** — bottom tab navigation, dark mode, smooth sheet transitions, native reading typography.

## Features

- **Topic onboarding** — choose from NYC Local, Sports, Tech, World, Politics, Entertainment, Business, **Markets**, Science — or **Follow everything** in one tap. Change picks any time from a compact chip picker in Settings (no more one-switch-per-topic).
- **Markets** — a dedicated finance section: Bloomberg (Markets / Technology / Economics), Yahoo Finance, CNBC, MarketWatch, WSJ Markets, FT. A feed shared with Business shows up under both.
- **Aggregated feed** — headlines merged across ~50 sources (free outlets *and* premium ones: NYT, WSJ, WaPo, The Economist, FT, Bloomberg, Wired, MIT Tech Review…), deduped and sorted newest-first.
- **Curated vs. Latest** — the feed opens **Curated**: an AI curator hides low-signal noise (sponsored posts, affiliate deal roundups, horoscopes, "Wordle answer", SEO filler) and near-duplicate wire copy, then blends recency with a newsworthiness score. One tap flips to **Latest** — the raw newest-first firehose. "Not interested" (✕ on a card) hides a story for good.
- **The Edition** — a tab that downloads a balanced **15 stories for your commute**: curated, spread across your topics, with the full article text baked in so it reads with **no signal on the train**. Auto-refreshes each morning (toggle in Settings) or download on demand.
- **Unlock badge** — articles from paywalled publishers carry an **Unlock** badge in the feed, an at-a-glance signal of what the app opens up for you.
- **Publisher pages** — tap any source name/favicon (in the feed, reader, or Settings) to open that outlet's "homepage" — every story from them across all sections, newest-first.
- **AI summaries** — one neutral sentence per story, with **free providers** (Google Gemini, Groq, or local Ollama) or paid Claude — auto-detected from your config, batched + cached. Optional — falls back to source snippets with no key.
- **Reader mode** — tap to read the full article natively (ads/chrome stripped via Mozilla Readability), in Apple-News-style serif typography. Paywalled stories show an "Unlocked for you" badge.
- **Paywall bypass** — paywalled/truncated articles are silently refetched via `archive.today`, then `removepaywalls.com`, then `12ft.io`, and rendered inline. Degrades gracefully to "Open original" when bypass isn't possible.
- **Saved list** — star stories to read later (stored locally).
- **Dark mode** — System / Light / Dark, with iOS-accurate palettes.
- **Auto-refresh** — the feed refreshes periodically and when you return to the tab.

## Architecture

```
React (Vite, :5173)  ──/api proxy──▶  Express backend (:3001)
  onboarding / feed / reader               ├─ aggregate.js  RSS fetch (follows redirects) + parse + merge
  Edition (offline top-15)                 ├─ llm.js        provider selection + one callLLM()
  bottom tabs / dark mode                  ├─ summarize.js  one-sentence summary + curator score (batched, cached)
                                           ├─ curate.js     no-AI junk / near-dupe filter (runs on every feed)
                                           ├─ edition.js    aggregate → curate → score → balance → prefetch readers
                                           ├─ reader.js     Readability + paywall fallback chain
                                           └─ cache.js      TTL cache (disk-persisted)
```

The AI curator adds **no latency** to the feed: `/api/feed?curated=1` only runs the synchronous `curate.js` layer, and the newsworthiness score rides the same batched `/api/summarize` call that was already fetching one-sentence briefs. The client hides `junk || score < 25` as scores stream in.

A small backend is required because: RSS feeds and the bypass proxies can't be fetched from the browser (CORS), and the Claude API key must stay server-side.

## Getting started

```bash
# 1. Install
npm install

# 2. Configure (optional but recommended — enables AI summaries)
cp .env.example .env
#   then edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Run (starts the API on :3001 and the web app on :5173)
npm run dev
```

Open **http://localhost:5173**.

Without an `ANTHROPIC_API_KEY` the app runs fine — it just shows source snippets instead of AI summaries and tells you summaries are off.

### Production build

```bash
npm run build      # builds the React app into dist/
npm start          # serves dist/ + the API from :3001
```

### Deploy (always-on, no PC required)

The app is a single Node service (Express serves the built frontend + API), so any
Node host works. Easiest is **Render** (free tier, HTTPS) — a `render.yaml` is included:

1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Web Service** → connect the repo
   (Render auto-detects `render.yaml`).
3. Add your secret: **Environment → `GEMINI_API_KEY`** = your key.
4. Deploy. You get an `https://<name>.onrender.com` URL — open it in Safari and
   **Add to Home Screen** for the full PWA (HTTPS = offline caching works too).

Set the same env vars (`GEMINI_API_KEY`, optional `GEMINI_MODEL`) on any other host
(Railway, Fly, Vercel functions, a VPS). The free Render tier sleeps after ~15 min idle
(≈50 s cold start); paid tiers / Railway stay warm.

## Configuration

Set **one** summary provider (all optional — without any, the feed shows source snippets). See `.env.example` for the full list.

| Variable            | Provider | Notes                                                                |
| ------------------- | -------- | -------------------------------------------------------------------- |
| `GEMINI_API_KEY`    | Gemini (free)   | Easiest free AI, no credit card — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY`      | Groq (free)     | Free + very fast — [console.groq.com/keys](https://console.groq.com/keys) |
| `OLLAMA_MODEL`      | Ollama (free)   | 100% local/private — install [ollama.com](https://ollama.com), `ollama pull llama3.2` |
| `ANTHROPIC_API_KEY` | Claude (paid)   | Pennies per 1,000 summaries. `BRIEF_MODEL` defaults to `claude-haiku-4-5`. |
| `SUMMARY_PROVIDER`  | —        | Force a provider; otherwise auto-detected from the keys above.       |
| `PORT`              | —        | Backend port (default `3001`; the dev server proxies `/api` here).   |

## API

| Endpoint                          | Description                                              |
| --------------------------------- | ------------------------------------------------------- |
| `GET /api/topics`                 | Topic catalog for onboarding.                           |
| `GET /api/feed?topics=tech,world` | Merged, sorted articles. Add `&curated=1` for the junk/dupe-filtered, re-ranked feed. |
| `POST /api/summarize`             | `{ articles: [...] }` → `{ summaries: {url: text}, curation: {url: {score, junk}} }` (cached). |
| `GET /api/edition?topics=…&n=15`  | Balanced daily top-N with clean reader text baked in, for offline reading (cached 12h). |
| `GET /api/article?url=...`        | Clean reader-mode content, with paywall bypass.         |
| `GET /api/publisher?domain=...`   | All articles from one publisher across every section.   |
| `GET /api/health`                 | Status + whether summaries are configured.              |

## Customizing sources

Topics and their RSS feeds live in [`server/feeds.js`](server/feeds.js) — add a feed by dropping a `{ source, domain, url, paywalled? }` into any topic's `feeds` array (and mirror the label/emoji in [`src/topics.js`](src/topics.js)). The same feed can live in several topics — it's fetched once and tagged with every matching topic, so a per-topic filter shows it under each. Feed fetching follows redirects, so `feeds.host` URLs that 301 to `www.` work fine.

## A note on paywalls

The bypass step uses public services (`removepaywalls.com`, `12ft.io`). These are best-effort and frequently rate-limit or go offline, and many large publishers (e.g. NYT) hard-block automated fetches — in those cases the reader shows an "Open original" link. This feature is intended for personal reading; please support publishers whose work you value.
