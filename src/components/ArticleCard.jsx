import { useEffect, useRef, useState } from "react";
import { timeAgo } from "../hooks.js";
import { TOPIC_EMOJI } from "../topics.js";
import { UnlockIcon, SourceIcon } from "./icons.jsx";

export default function ArticleCard({
  article,
  index,
  summary,
  summariesEnabled,
  onOpen,
  onToggleSave,
  saved,
  onVisible,
  onOpenPublisher,
}) {
  const ref = useRef(null);
  const firedRef = useRef(false);
  const [imgOk, setImgOk] = useState(Boolean(article.image));

  useEffect(() => {
    if (!ref.current || firedRef.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !firedRef.current) {
            firedRef.current = true;
            onVisible?.(article, index);
            obs.disconnect();
          }
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [article, index, onVisible]);

  // The brief line: AI summary if we have it, else the source snippet.
  const brief = summary || article.snippet;
  const showSpinner = summariesEnabled && !summary;

  return (
    <article className="card" ref={ref} onClick={() => onOpen(article)}>
      <div className="card-body">
        <div className="card-meta">
          <span
            className={`card-source ${onOpenPublisher && article.domain ? "tappable" : ""}`}
            onClick={(e) => {
              if (!onOpenPublisher || !article.domain) return;
              e.stopPropagation();
              onOpenPublisher(article.domain);
            }}
          >
            <SourceIcon domain={article.domain} emoji={TOPIC_EMOJI[article.topicId]} />
            {article.source}
          </span>
          {article.paywalled && (
            <span className="unlock-chip" title="Paywalled — The Brief unlocks this for you">
              <UnlockIcon />
              Unlock
            </span>
          )}
          <span className="card-dot">·</span>
          <span className="card-time">{timeAgo(article.publishedAt)}</span>
        </div>

        <h2 className="card-title">{article.title}</h2>

        <p className={`card-brief ${showSpinner && !brief ? "loading" : ""}`}>
          {brief ? (
            <>
              {showSpinner && <span className="ai-dot" title="AI summary loading" />}
              {brief}
            </>
          ) : showSpinner ? (
            <span className="brief-shimmer" />
          ) : null}
        </p>
      </div>

      {imgOk && article.image && (
        <div className="card-thumb">
          <img src={article.image} alt="" loading="lazy" onError={() => setImgOk(false)} />
        </div>
      )}

      <button
        className={`save-btn ${saved ? "on" : ""}`}
        aria-label={saved ? "Remove from saved" : "Save"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSave(article);
        }}
        type="button"
      >
        {saved ? "★" : "☆"}
      </button>
    </article>
  );
}
