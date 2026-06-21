// Shared inline SVG icons.

import { useState } from "react";

// Publication favicon, with a graceful fallback to the topic emoji.
export function SourceIcon({ domain, emoji, size = 16 }) {
  const [failed, setFailed] = useState(false);
  if (!domain || failed) {
    return (
      <span className="source-emoji" style={{ fontSize: `${size - 2}px` }} aria-hidden="true">
        {emoji || "📰"}
      </span>
    );
  }
  return (
    <img
      className="source-favicon"
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function UnlockIcon({ size = 12 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2.2" />
      {/* open shackle — swung to the side to read as "unlocked" */}
      <path d="M8 11V7a4 4 0 0 1 7.5-1.9" strokeLinecap="round" />
    </svg>
  );
}
