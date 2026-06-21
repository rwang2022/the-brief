import { useEffect, useState } from "react";
import { getTopics } from "../api.js";

export default function Onboarding({ onDone }) {
  const [topics, setTopics] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTopics()
      .then((d) => setTopics(d.topics))
      .catch(() => setTopics([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="onboarding">
      <div className="onboarding-inner">
        <div className="onboarding-head">
          <div className="brand-mark">The Brief</div>
          <h1>What do you want to follow?</h1>
          <p>Pick a few topics. We'll pull the latest headlines and brief you in a sentence.</p>
        </div>

        {loading ? (
          <div className="onboarding-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="topic-chip skeleton-chip" />
            ))}
          </div>
        ) : (
          <div className="onboarding-grid">
            {topics.map((t) => {
              const on = picked.has(t.id);
              return (
                <button
                  key={t.id}
                  className={`topic-chip ${on ? "on" : ""}`}
                  onClick={() => toggle(t.id)}
                  type="button"
                >
                  <span className="topic-emoji">{t.emoji}</span>
                  <span className="topic-label">{t.label}</span>
                  <span className="topic-check">{on ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="onboarding-foot">
        <button
          className="primary-btn"
          disabled={picked.size === 0}
          onClick={() => onDone([...picked])}
          type="button"
        >
          {picked.size === 0 ? "Select at least one" : `Continue with ${picked.size}`}
        </button>
      </div>
    </div>
  );
}
