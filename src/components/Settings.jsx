import { useEffect, useState } from "react";
import { getTopics } from "../api.js";
import { SourceIcon, UnlockIcon } from "./icons.jsx";

const THEMES = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export default function Settings({
  topics,
  onChangeTopics,
  theme,
  onChangeTheme,
  onOpenPublisher,
  muted = [],
  onToggleMute,
}) {
  const [allTopics, setAllTopics] = useState([]);
  const picked = new Set(topics);

  // domain -> friendly source name, from the catalog.
  const nameByDomain = {};
  for (const t of allTopics) for (const s of t.sources || []) nameByDomain[s.domain] = s.source;

  useEffect(() => {
    getTopics()
      .then((d) => setAllTopics(d.topics))
      .catch(() => setAllTopics([]));
  }, []);

  const toggleTopic = (id) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    if (next.size === 0) return; // keep at least one
    onChangeTopics([...next]);
  };

  return (
    <div className="settings">
      <header className="feed-header">
        <div className="feed-title-row">
          <div>
            <div className="feed-eyebrow">Make it yours</div>
            <h1 className="feed-title">Settings</h1>
          </div>
        </div>
      </header>

      <section className="settings-section">
        <h3 className="settings-label">Appearance</h3>
        <div className="segmented">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`segment ${theme === t.id ? "on" : ""}`}
              onClick={() => onChangeTheme(t.id)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-label">Your topics</h3>
        <div className="settings-topics">
          {allTopics.map((t) => {
            const on = picked.has(t.id);
            return (
              <button
                key={t.id}
                className={`topic-row ${on ? "on" : ""}`}
                onClick={() => toggleTopic(t.id)}
                type="button"
              >
                <span className="topic-row-left">
                  <span className="topic-emoji">{t.emoji}</span>
                  <span>{t.label}</span>
                </span>
                <span className={`switch ${on ? "on" : ""}`}>
                  <span className="switch-knob" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {muted.length > 0 && (
        <section className="settings-section">
          <h3 className="settings-label">Muted ({muted.length})</h3>
          <div className="source-chips">
            {muted.map((domain) => (
              <button
                key={domain}
                className="source-chip muted-chip"
                onClick={() => onToggleMute && onToggleMute(domain)}
                type="button"
                title="Tap to unmute"
              >
                <SourceIcon domain={domain} size={16} />
                {nameByDomain[domain] || domain}
                <span className="muted-x">✕</span>
              </button>
            ))}
          </div>
          <p className="settings-fine" style={{ marginTop: "8px" }}>
            Muted sources are hidden from your feed and search. Tap to unmute.
          </p>
        </section>
      )}

      <section className="settings-section">
        <h3 className="settings-label">Sources</h3>
        {(() => {
          const total = allTopics.reduce((n, t) => n + (t.sources?.length || 0), 0);
          return (
            <p className="sources-intro">
              Headlines from <b>{total}</b> publications across <b>{allTopics.length}</b> topics —
              free outlets and premium ones we unlock for you.
            </p>
          );
        })()}
        {allTopics.map((t) => (
          <div key={t.id} className="source-group">
            <div className="source-group-head">
              <span>{t.emoji}</span> {t.label}
            </div>
            <div className="source-chips">
              {(t.sources || []).map((s) => (
                <button
                  key={s.source}
                  className={`source-chip tappable ${s.paywalled ? "paywalled" : ""}`}
                  onClick={() => onOpenPublisher && onOpenPublisher(s.domain)}
                  type="button"
                >
                  <SourceIcon domain={s.domain} size={16} />
                  {s.source}
                  {s.paywalled && <UnlockIcon size={11} />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="settings-section">
        <h3 className="settings-label">About</h3>
        <p className="settings-about">
          The Brief pulls headlines from dozens of sources — free outlets and premium ones alike
          (NYT, WSJ, The Economist, Wired, and more). Stories marked with an <b>Unlock</b> badge
          come from paywalled publishers; tap to read them in a clean, native reader and The Brief
          fetches the full text through public bypass services automatically.
        </p>
        <p className="settings-fine">
          Bypass is best-effort and intended for personal reading. Please support publishers whose
          work you value.
        </p>
      </section>
    </div>
  );
}
