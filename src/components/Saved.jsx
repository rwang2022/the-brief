import { timeAgo } from "../hooks.js";
import { TOPIC_EMOJI } from "../topics.js";
import { SourceIcon } from "./icons.jsx";

export default function Saved({ saved, onOpen, onToggleSave, onOpenPublisher }) {
  return (
    <div className="feed">
      <header className="feed-header">
        <div className="feed-title-row">
          <div>
            <div className="feed-eyebrow">Your reading list</div>
            <h1 className="feed-title">Saved</h1>
          </div>
        </div>
      </header>

      {saved.length === 0 ? (
        <div className="empty-state">
          <div className="empty-emoji">🔖</div>
          <p>Nothing saved yet.</p>
          <span className="empty-sub">Tap the star on any story to keep it here.</span>
        </div>
      ) : (
        <div className="feed-list">
          {saved.map((article) => (
            <article key={article.url} className="card" onClick={() => onOpen(article)}>
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
                  <span className="card-dot">·</span>
                  <span className="card-time">{timeAgo(article.publishedAt)}</span>
                </div>
                <h2 className="card-title">{article.title}</h2>
                {article.snippet && <p className="card-brief">{article.snippet}</p>}
              </div>
              {article.image && (
                <div className="card-thumb">
                  <img src={article.image} alt="" loading="lazy" />
                </div>
              )}
              <button
                className="save-btn on"
                aria-label="Remove from saved"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(article);
                }}
                type="button"
              >
                ★
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
