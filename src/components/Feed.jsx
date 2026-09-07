import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFeed, getSummaries } from "../api.js";
import { TOPIC_LABELS } from "../topics.js";
import { useLocalStorage } from "../hooks.js";
import ArticleCard from "./ArticleCard.jsx";
import { useVisibilityRefresh } from "../hooks.js";

const REFRESH_MS = 10 * 60 * 1000; // auto-refresh throughout the day
const LOW_SCORE = 25; // AI curator score below which a story is treated as low-signal

export default function Feed({
  topics,
  onOpen,
  onToggleSave,
  isSaved,
  onOpenPublisher,
  mutedDomains = [],
  hiddenUrls = [],
  onHideArticle,
}) {
  const [articles, setArticles] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [curation, setCuration] = useState({}); // url -> { score, junk }
  const [collapsing, setCollapsing] = useState(() => new Set()); // urls mid-collapse
  const [serverHidden, setServerHidden] = useState(0);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useLocalStorage("brief.feedMode", "curated"); // curated | latest
  const [summariesEnabled, setSummariesEnabled] = useState(true);
  const [generatedAt, setGeneratedAt] = useState(null);
  const summarizing = useRef(new Set());

  const curated = mode === "curated";

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setStatus((s) => (s === "ready" ? s : "loading"));
      setRefreshing(true);
      try {
        const data = await getFeed(topics, { curated });
        setArticles(data.articles);
        setServerHidden(data.hidden || 0);
        setSummariesEnabled(data.summariesEnabled);
        setGeneratedAt(data.generatedAt);
        setStatus("ready");
      } catch {
        setStatus("error");
      } finally {
        setRefreshing(false);
      }
    },
    [topics, curated]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Periodic refresh + refresh on tab focus.
  useEffect(() => {
    const id = setInterval(() => load({ silent: true }), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);
  useVisibilityRefresh(() => load({ silent: true }), true);

  const isLowSignal = useCallback(
    (url) => {
      const c = curation[url];
      return Boolean(c && (c.junk || (typeof c.score === "number" && c.score < LOW_SCORE)));
    },
    [curation]
  );

  // Everything that passes the local filters (mute / hidden / topic pill).
  const baseVisible = useMemo(() => {
    const muted = new Set(mutedDomains);
    const hidden = new Set(hiddenUrls);
    const live = articles.filter((a) => !muted.has(a.domain) && !hidden.has(a.url));
    if (filter === "all") return live;
    return live
      .filter((a) => (a.topicIds || [a.topicId]).includes(filter))
      .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
  }, [articles, filter, mutedDomains, hiddenUrls]);

  // In curated mode, low-signal stories drop out (kept briefly while they collapse).
  const visible = useMemo(() => {
    if (!curated) return baseVisible;
    return baseVisible.filter((a) => !isLowSignal(a.url) || collapsing.has(a.url));
  }, [baseVisible, curated, isLowSignal, collapsing]);

  const aiHiddenCount = useMemo(
    () => (curated ? baseVisible.filter((a) => isLowSignal(a.url) && !collapsing.has(a.url)).length : 0),
    [baseVisible, curated, isLowSignal, collapsing]
  );
  const hiddenNote = serverHidden + aiHiddenCount;

  // Drive the collapse animation for stories the curator just flagged.
  useEffect(() => {
    if (!curated) return;
    const newlyLow = baseVisible
      .filter((a) => isLowSignal(a.url) && !collapsing.has(a.url))
      .map((a) => a.url);
    if (newlyLow.length === 0) return;
    setCollapsing((prev) => new Set([...prev, ...newlyLow]));
    const t = setTimeout(() => setCollapsing(new Set()), 360);
    return () => clearTimeout(t);
  }, [curation, curated, baseVisible, isLowSignal, collapsing]);

  // Lazily fetch summaries (+ curator scores) for articles not yet processed.
  const requestSummaries = useCallback(
    async (batch) => {
      const need = batch.filter(
        (a) => a && !summaries[a.url] && !curation[a.url] && !summarizing.current.has(a.url)
      );
      if (need.length === 0 || !summariesEnabled) return;
      need.forEach((a) => summarizing.current.add(a.url));
      try {
        const { summaries: got, curation: gotCuration, enabled } = await getSummaries(need);
        if (enabled === false) setSummariesEnabled(false);
        if (got && Object.keys(got).length) setSummaries((prev) => ({ ...prev, ...got }));
        if (gotCuration && Object.keys(gotCuration).length)
          setCuration((prev) => ({ ...prev, ...gotCuration }));
      } catch {
        /* leave snippet fallback in place */
      } finally {
        need.forEach((a) => summarizing.current.delete(a.url));
      }
    },
    [summaries, curation, summariesEnabled]
  );

  // Kick off processing for the first screenful as soon as the feed loads.
  useEffect(() => {
    if (status === "ready" && baseVisible.length) {
      requestSummaries(baseVisible.slice(0, 12));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, baseVisible.length, filter, mode]);

  const onCardVisible = useCallback(
    (article, index) => {
      const slice = visible.slice(index, index + 6);
      requestSummaries(slice);
    },
    [visible, requestSummaries]
  );

  return (
    <div className="feed">
      <header className="feed-header">
        <div className="feed-title-row">
          <div>
            <div className="feed-eyebrow">{todayLabel()}</div>
            <h1 className="feed-title">The Brief</h1>
          </div>
          <button
            className={`refresh-btn ${refreshing ? "spinning" : ""}`}
            onClick={() => load({ silent: true })}
            aria-label="Refresh"
            type="button"
          >
            ↻
          </button>
        </div>

        <div className="feed-mode" role="tablist" aria-label="Feed mode">
          <button
            className={curated ? "on" : ""}
            onClick={() => setMode("curated")}
            type="button"
            role="tab"
          >
            Curated
          </button>
          <button
            className={!curated ? "on" : ""}
            onClick={() => setMode("latest")}
            type="button"
            role="tab"
          >
            Latest
          </button>
        </div>

        <div className="topic-filter" role="tablist">
          <FilterPill label="All" on={filter === "all"} onClick={() => setFilter("all")} />
          {topics.map((t) => (
            <FilterPill
              key={t}
              label={TOPIC_LABELS[t] || t}
              on={filter === t}
              onClick={() => setFilter(t)}
            />
          ))}
        </div>
      </header>

      {status === "loading" && <FeedSkeleton />}

      {status === "error" && (
        <div className="empty-state">
          <p>Couldn't load the feed.</p>
          <button className="primary-btn" onClick={() => load()} type="button">
            Try again
          </button>
        </div>
      )}

      {status === "ready" && visible.length === 0 && (
        <div className="empty-state">
          <p>No stories right now. Pull to refresh in a bit.</p>
        </div>
      )}

      {status === "ready" && (
        <div className="feed-list">
          {curated && hiddenNote > 0 && (
            <div className="feed-hidden-note">
              <span>
                {hiddenNote} low-signal {hiddenNote === 1 ? "story" : "stories"} hidden
              </span>
              <button type="button" onClick={() => setMode("latest")}>
                Show all
              </button>
            </div>
          )}
          {visible.map((article, i) => (
            <ArticleCard
              key={article.url || article.id}
              article={article}
              index={i}
              summary={summaries[article.url]}
              summariesEnabled={summariesEnabled}
              collapsing={collapsing.has(article.url)}
              onOpen={onOpen}
              onToggleSave={onToggleSave}
              saved={isSaved(article.url)}
              onVisible={onCardVisible}
              onOpenPublisher={onOpenPublisher}
              onHide={onHideArticle}
            />
          ))}
          {generatedAt && (
            <div className="feed-foot">Updated {new Date(generatedAt).toLocaleTimeString()}</div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterPill({ label, on, onClick }) {
  return (
    <button className={`filter-pill ${on ? "on" : ""}`} onClick={onClick} type="button" role="tab">
      {label}
    </button>
  );
}

function FeedSkeleton() {
  return (
    <div className="feed-list">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="skeleton-line w-40" />
          <div className="skeleton-line w-90" />
          <div className="skeleton-line w-70" />
        </div>
      ))}
    </div>
  );
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
