import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFeed, getSummaries } from "../api.js";
import { TOPIC_LABELS } from "../topics.js";
import ArticleCard from "./ArticleCard.jsx";
import { useVisibilityRefresh } from "../hooks.js";

const REFRESH_MS = 10 * 60 * 1000; // auto-refresh throughout the day

export default function Feed({ topics, onOpen, onToggleSave, isSaved, onOpenPublisher, mutedDomains = [] }) {
  const [articles, setArticles] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [summariesEnabled, setSummariesEnabled] = useState(true);
  const [generatedAt, setGeneratedAt] = useState(null);
  const summarizing = useRef(new Set());

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setStatus((s) => (s === "ready" ? s : "loading"));
      setRefreshing(true);
      try {
        const data = await getFeed(topics);
        setArticles(data.articles);
        setSummariesEnabled(data.summariesEnabled);
        setGeneratedAt(data.generatedAt);
        setStatus("ready");
      } catch {
        setStatus("error");
      } finally {
        setRefreshing(false);
      }
    },
    [topics]
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

  const visible = useMemo(() => {
    const muted = new Set(mutedDomains);
    const live = articles.filter((a) => !muted.has(a.domain));
    // "All" uses the server's balanced topic/source interleave; a specific topic
    // filter shows that topic strictly newest-first.
    if (filter === "all") return live;
    return live
      .filter((a) => a.topicId === filter)
      .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
  }, [articles, filter, mutedDomains]);

  // Lazily fetch summaries for articles that don't have one yet, in small waves.
  const requestSummaries = useCallback(
    async (batch) => {
      const need = batch.filter(
        (a) => a && !summaries[a.url] && !summarizing.current.has(a.url)
      );
      if (need.length === 0 || !summariesEnabled) return;
      need.forEach((a) => summarizing.current.add(a.url));
      try {
        const { summaries: got, enabled } = await getSummaries(need);
        if (enabled === false) setSummariesEnabled(false);
        if (got && Object.keys(got).length) setSummaries((prev) => ({ ...prev, ...got }));
      } catch {
        /* leave snippet fallback in place */
      } finally {
        need.forEach((a) => summarizing.current.delete(a.url));
      }
    },
    [summaries, summariesEnabled]
  );

  // Kick off summary generation for the first screenful as soon as the feed loads.
  useEffect(() => {
    if (status === "ready" && visible.length) {
      requestSummaries(visible.slice(0, 12));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, visible.length, filter]);

  const onCardVisible = useCallback(
    (article, index) => {
      // When a card scrolls into view, summarize it and the next few.
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
          {visible.map((article, i) => (
            <ArticleCard
              key={article.url || article.id}
              article={article}
              index={i}
              summary={summaries[article.url]}
              summariesEnabled={summariesEnabled}
              onOpen={onOpen}
              onToggleSave={onToggleSave}
              saved={isSaved(article.url)}
              onVisible={onCardVisible}
              onOpenPublisher={onOpenPublisher}
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
