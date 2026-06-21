import { useEffect, useState } from "react";
import { getPublisher } from "../api.js";
import ArticleCard from "./ArticleCard.jsx";
import { SourceIcon, UnlockIcon } from "./icons.jsx";

// A publisher "homepage" — every story from one outlet across all its sections.
export default function Publisher({ domain, onOpenArticle, onToggleSave, isSaved, onClose, muted, onToggleMute }) {
  const [state, setState] = useState({ status: "loading", data: null });
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", data: null });
    getPublisher(domain)
      .then((data) => alive && setState({ status: "ready", data }))
      .catch(() => alive && setState({ status: "error", data: null }));
    return () => {
      alive = false;
    };
  }, [domain]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 220);
  };

  const data = state.data;
  const publisher = data?.publisher;
  const articles = data?.articles || [];

  return (
    <div className={`reader-overlay publisher-overlay ${closing ? "closing" : ""}`}>
      <div className="reader-sheet">
        <div className="reader-bar">
          <button className="reader-close" onClick={close} type="button" aria-label="Close">
            ‹ Back
          </button>
          {publisher && (
            <a className="reader-source-link" href={`https://${domain}`} target="_blank" rel="noreferrer">
              {domain} ↗
            </a>
          )}
        </div>

        <div className="reader-scroll">
          <header className="publisher-head">
            <div className="publisher-icon">
              <SourceIcon domain={domain} size={48} />
            </div>
            <h1 className="publisher-name">
              {publisher?.name || domain}
              {publisher?.paywalled && (
                <span className="unlock-chip publisher-unlock">
                  <UnlockIcon /> Unlock
                </span>
              )}
            </h1>
            {state.status === "ready" && (
              <p className="publisher-sub">
                {articles.length} recent {articles.length === 1 ? "story" : "stories"}
                {publisher?.sections?.length ? ` · ${[...new Set(publisher.sections)].join(", ")}` : ""}
              </p>
            )}
            {onToggleMute && (
              <button
                className={`publisher-mute ${muted ? "muted" : ""}`}
                onClick={() => onToggleMute(domain)}
                type="button"
              >
                {muted ? "✓ Muted — tap to show" : "Mute this source"}
              </button>
            )}
          </header>

          {state.status === "loading" && (
            <div className="feed-list">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card skeleton-card">
                  <div className="skeleton-line w-40" />
                  <div className="skeleton-line w-90" />
                  <div className="skeleton-line w-70" />
                </div>
              ))}
            </div>
          )}

          {state.status === "ready" && articles.length === 0 && (
            <div className="empty-state">
              <p>No recent stories from {publisher?.name || domain}.</p>
            </div>
          )}

          {state.status === "error" && (
            <div className="empty-state">
              <p>Couldn't load this publisher.</p>
            </div>
          )}

          {state.status === "ready" && articles.length > 0 && (
            <div className="feed-list">
              {articles.map((article, i) => (
                <ArticleCard
                  key={article.url || article.id}
                  article={article}
                  index={i}
                  summary={undefined}
                  summariesEnabled={false}
                  onOpen={onOpenArticle}
                  onToggleSave={onToggleSave}
                  saved={isSaved(article.url)}
                  onVisible={() => {}}
                  onOpenPublisher={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
