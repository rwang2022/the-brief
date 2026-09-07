import { useCallback, useEffect, useRef, useState } from "react";
import { getEdition } from "../api.js";
import { loadEdition, saveEdition, isEditionFresh, readMeta } from "../edition.js";
import { TOPIC_EMOJI } from "../topics.js";
import { SourceIcon, UnlockIcon } from "./icons.jsx";

function readMins(words) {
  if (!words) return null;
  return Math.max(1, Math.round(words / 220));
}

function editionDateLabel(date) {
  const d = date ? new Date(`${date}T00:00:00`) : new Date();
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export default function Edition({ topics, onOpen, onToggleSave, isSaved, onOpenPublisher, auto = true }) {
  const [bundle, setBundle] = useState(null);
  const [status, setStatus] = useState("init"); // init | idle | loading | ready | error
  const [meta, setMeta] = useState(() => readMeta());
  const autoTried = useRef(false);

  const download = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await getEdition(topics, 15);
      const m = await saveEdition(data);
      setBundle(data);
      setMeta(m);
      setStatus("ready");
    } catch {
      setStatus((s) => (bundle ? "ready" : "error"));
    }
  }, [topics, bundle]);

  // On mount: use a stored edition if we have one; otherwise try a silent
  // auto-download (once) when it's enabled and we're online.
  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await loadEdition();
      if (!alive) return;
      if (stored) {
        setBundle(stored);
        setMeta(readMeta());
        setStatus("ready");
      } else {
        setStatus("idle");
      }
      const online = typeof navigator === "undefined" || navigator.onLine;
      if (!stored || !isEditionFresh()) {
        if (auto && online && !autoTried.current) {
          autoTried.current = true;
          download();
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stale = bundle && !isEditionFresh(meta);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div className="feed">
      <header className="feed-header">
        <div className="feed-title-row">
          <div>
            <div className="feed-eyebrow">{editionDateLabel(bundle?.date)}</div>
            <h1 className="feed-title">The Edition</h1>
          </div>
        </div>
      </header>

      {status === "loading" && !bundle && (
        <div className="edition-empty">
          <div className="empty-emoji">📊</div>
          <h2>Building today's Edition…</h2>
          <p className="edition-progress">Curating the day's stories and downloading them for offline reading.</p>
        </div>
      )}

      {status === "error" && !bundle && (
        <div className="edition-empty">
          <div className="empty-emoji">📡</div>
          <h2>{offline ? "You're offline" : "Couldn't build the Edition"}</h2>
          <p>
            {offline
              ? "Connect to the internet once to download today's 15 stories, then they'll read fully offline."
              : "Something went wrong putting the Edition together."}
          </p>
          {!offline && (
            <button className="primary-btn" onClick={download} type="button">
              Try again
            </button>
          )}
        </div>
      )}

      {status === "idle" && !bundle && (
        <div className="edition-empty">
          <div className="empty-emoji">🚆</div>
          <h2>15 stories for your commute</h2>
          <p>
            A curated, balanced brief of the day's most interesting reporting — downloaded in full so it
            reads with no signal on the train.
          </p>
          <button className="primary-btn" onClick={download} type="button" disabled={offline}>
            {offline ? "Offline — connect to download" : "Download today's Edition"}
          </button>
        </div>
      )}

      {bundle && (
        <>
          {stale && (
            <div className="feed-hidden-note">
              <span>This Edition is from {editionDateLabel(bundle.date)}.</span>
              <button type="button" onClick={download} disabled={status === "loading" || offline}>
                {status === "loading" ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          )}
          <div className="edition-list">
            {bundle.articles.map((article, i) => {
              const mins = readMins(article.reader?.wordCount);
              return (
                <button
                  key={article.url || article.id}
                  className="edition-item"
                  onClick={() => onOpen(article)}
                  type="button"
                >
                  <span className="edition-num">{i + 1}</span>
                  <span className="edition-body">
                    <span className="card-meta">
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
                        <span className="unlock-chip" title="Paywalled — unlocked for you">
                          <UnlockIcon />
                          Unlock
                        </span>
                      )}
                      {mins && (
                        <>
                          <span className="card-dot">·</span>
                          <span className="card-time">{mins} min read</span>
                        </>
                      )}
                      {!article.reader && (
                        <>
                          <span className="card-dot">·</span>
                          <span className="card-time">opens online</span>
                        </>
                      )}
                    </span>
                    <h3>{article.title}</h3>
                    {(article.summary || article.snippet) && <p>{article.summary || article.snippet}</p>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="edition-foot">
            <span className="edition-offline-tag">
              <UnlockIcon size={11} /> {bundle.count} stories · works offline
            </span>
            <button
              type="button"
              onClick={download}
              disabled={status === "loading" || offline}
            >
              {status === "loading" ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
