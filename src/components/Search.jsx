import { useEffect, useMemo, useRef, useState } from "react";
import { getFeed } from "../api.js";
import ArticleCard from "./ArticleCard.jsx";

export default function Search({ topics, onOpen, onToggleSave, isSaved, onOpenPublisher, mutedDomains = [] }) {
  const [pool, setPool] = useState([]);
  const [status, setStatus] = useState("loading");
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getFeed(topics)
      .then((d) => {
        if (!alive) return;
        setPool(d.articles);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [topics]);

  // Autofocus the field when the tab opens.
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(id);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const muted = new Set(mutedDomains);
    const terms = q.split(/\s+/);
    return pool
      .filter((a) => !muted.has(a.domain))
      .map((a) => {
        const haystack = `${a.title} ${a.snippet} ${a.source} ${a.topicLabel}`.toLowerCase();
        // Every term must appear; title hits rank higher.
        if (!terms.every((t) => haystack.includes(t))) return null;
        const titleLower = a.title.toLowerCase();
        const score = terms.reduce((acc, t) => acc + (titleLower.includes(t) ? 2 : 1), 0);
        return { a, score };
      })
      .filter(Boolean)
      .sort((x, y) => y.score - x.score)
      .map((x) => x.a);
  }, [query, pool, mutedDomains]);

  return (
    <div className="feed">
      <header className="feed-header">
        <div className="feed-title-row">
          <div>
            <div className="feed-eyebrow">Across your topics</div>
            <h1 className="feed-title">Search</h1>
          </div>
        </div>
        <div className="search-bar">
          <span className="search-icon">⌕</span>
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            inputMode="search"
            placeholder="Search headlines…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery("")} type="button" aria-label="Clear">
              ✕
            </button>
          )}
        </div>
      </header>

      {status === "loading" && (
        <div className="empty-state">
          <p>Loading stories…</p>
        </div>
      )}

      {status === "ready" && !query && (
        <div className="empty-state">
          <div className="empty-emoji">🔍</div>
          <p>Search {pool.length} stories</p>
          <span className="empty-sub">Try a name, place, team, or topic.</span>
        </div>
      )}

      {status === "ready" && query && results.length === 0 && (
        <div className="empty-state">
          <p>No matches for "{query}"</p>
          <span className="empty-sub">Try a different word.</span>
        </div>
      )}

      {status === "ready" && results.length > 0 && (
        <div className="feed-list">
          <div className="search-count">
            {results.length} result{results.length === 1 ? "" : "s"}
          </div>
          {results.map((article, i) => (
            <ArticleCard
              key={article.url || article.id}
              article={article}
              index={i}
              summary={undefined}
              summariesEnabled={false}
              onOpen={onOpen}
              onToggleSave={onToggleSave}
              saved={isSaved(article.url)}
              onVisible={() => {}}
              onOpenPublisher={onOpenPublisher}
            />
          ))}
        </div>
      )}
    </div>
  );
}
