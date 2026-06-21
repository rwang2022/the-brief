import { useEffect, useState } from "react";
import { getArticle } from "../api.js";
import { timeAgo } from "../hooks.js";
import { UnlockIcon, SourceIcon } from "./icons.jsx";

export default function Reader({ article, onClose, onToggleSave, isSaved, onOpenPublisher }) {
  const [state, setState] = useState({ status: "loading", data: null });
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading", data: null });
    getArticle(article.url)
      .then((data) => {
        if (!alive) return;
        if (data.ok) setState({ status: "ready", data });
        else setState({ status: "error", data });
      })
      .catch(() => alive && setState({ status: "error", data: null }));
    return () => {
      alive = false;
    };
  }, [article.url]);

  // Lock body scroll while the reader is open.
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

  return (
    <div className={`reader-overlay ${closing ? "closing" : ""}`}>
      <div className="reader-sheet">
        <div className="reader-bar">
          <button className="reader-close" onClick={close} type="button" aria-label="Close">
            ‹ Back
          </button>
          <div className="reader-bar-actions">
            <button
              className={`reader-save ${isSaved ? "on" : ""}`}
              onClick={() => onToggleSave(article)}
              type="button"
              aria-label={isSaved ? "Remove from saved" : "Save"}
            >
              {isSaved ? "★" : "☆"}
            </button>
            <a className="reader-source-link" href={article.url} target="_blank" rel="noreferrer">
              Open ↗
            </a>
          </div>
        </div>

        <div className="reader-scroll">
          <div className="reader-content">
            <div className="reader-meta">
              <span
                className={`reader-meta-source ${onOpenPublisher && article.domain ? "tappable" : ""}`}
                onClick={() => onOpenPublisher && article.domain && onOpenPublisher(article.domain)}
              >
                <SourceIcon domain={article.domain} size={18} />
                {article.source}
              </span>
              <span className="card-dot">·</span>
              <span>{timeAgo(article.publishedAt)}</span>
            </div>

            <h1 className="reader-title">{data?.title || article.title}</h1>

            {data?.byline && <div className="reader-byline">{data.byline}</div>}

            {article.paywalled && state.status === "loading" && (
              <div className="reader-badge unlocking">
                <UnlockIcon size={13} /> Unlocking paywall…
              </div>
            )}

            {article.image && state.status !== "ready" && (
              <img className="reader-hero" src={article.image} alt="" />
            )}

            {state.status === "loading" && <ReaderSkeleton />}

            {state.status === "ready" && (
              <>
                {data.bypassed ? (
                  <div className="reader-badge unlocked">
                    <UnlockIcon size={13} /> Unlocked for you · via {prettyStrategy(data.strategy)}
                  </div>
                ) : (
                  article.paywalled && (
                    <div className="reader-badge unlocked">
                      <UnlockIcon size={13} /> Unlocked for you
                    </div>
                  )
                )}
                <article
                  className="reader-article"
                  // Content is sanitized server-side by Mozilla Readability.
                  dangerouslySetInnerHTML={{ __html: data.content }}
                />
                <div className="reader-end">— {data.siteName || article.source} ·{" "}
                  {data.wordCount ? `${data.wordCount} words` : "via The Brief"}
                </div>
              </>
            )}

            {state.status === "error" && (
              <div className="reader-error">
                {article.paywalled ? (
                  <>
                    <div className="reader-error-icon">
                      <UnlockIcon size={26} />
                    </div>
                    <p>
                      {article.source} blocks automated reading, so we couldn't render it inline.
                      Open the unlocked version — it loads full in your browser:
                    </p>
                    <a
                      className="primary-btn"
                      href={`https://removepaywalls.com/${article.url}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      🔓 Read unlocked ↗
                    </a>
                    <a className="reader-error-secondary" href={article.url} target="_blank" rel="noreferrer">
                      Open original on {article.source} ↗
                    </a>
                  </>
                ) : (
                  <>
                    <p>{(data && data.error) || "We couldn't extract a clean version of this story."}</p>
                    <a className="primary-btn" href={article.url} target="_blank" rel="noreferrer">
                      Open original ↗
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function prettyStrategy(s) {
  if (s === "removepaywalls") return "removepaywalls.com";
  if (s === "12ft") return "12ft.io";
  if (s === "jina") return "Jina Reader";
  if (s === "archive.today") return "archive.today";
  return s;
}

function ReaderSkeleton() {
  return (
    <div className="reader-skeleton">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className={`skeleton-line ${i % 3 === 0 ? "w-90" : i % 3 === 1 ? "w-100" : "w-70"}`} />
      ))}
    </div>
  );
}
