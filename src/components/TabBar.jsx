export default function TabBar({ active, onChange, savedCount }) {
  const tabs = [
    { id: "today", label: "Today", icon: TodayIcon },
    { id: "search", label: "Search", icon: SearchIcon },
    { id: "saved", label: "Saved", icon: SavedIcon, badge: savedCount },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <nav className="tabbar">
      {tabs.map((t) => {
        const Icon = t.icon;
        const on = active === t.id;
        return (
          <button
            key={t.id}
            className={`tab ${on ? "on" : ""}`}
            onClick={() => onChange(t.id)}
            type="button"
          >
            <span className="tab-icon">
              <Icon active={on} />
              {t.badge > 0 && <span className="tab-badge">{t.badge > 99 ? "99+" : t.badge}</span>}
            </span>
            <span className="tab-label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function TodayIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2.5" x2="8" y2="5.5" />
      <line x1="16" y1="2.5" x2="16" y2="5.5" />
    </svg>
  );
}

function SearchIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={active ? "2.4" : "1.8"}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.2" y1="16.2" x2="21" y2="21" strokeLinecap="round" />
    </svg>
  );
}

function SavedIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.5M12 19v2.5M4.5 12H2M22 12h-2.5M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </svg>
  );
}
