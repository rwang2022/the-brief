import { useEffect, useState, useCallback } from "react";
import Onboarding from "./components/Onboarding.jsx";
import Feed from "./components/Feed.jsx";
import Search from "./components/Search.jsx";
import Reader from "./components/Reader.jsx";
import Publisher from "./components/Publisher.jsx";
import Saved from "./components/Saved.jsx";
import Settings from "./components/Settings.jsx";
import TabBar from "./components/TabBar.jsx";
import { useLocalStorage } from "./hooks.js";

export default function App() {
  const [topics, setTopics] = useLocalStorage("brief.topics", null); // null = not onboarded
  const [theme, setTheme] = useLocalStorage("brief.theme", "system");
  const [saved, setSaved] = useLocalStorage("brief.saved", []);
  const [muted, setMuted] = useLocalStorage("brief.muted", []); // muted publisher domains
  const [tab, setTab] = useState("today");
  const [activeArticle, setActiveArticle] = useState(null);
  const [activePublisher, setActivePublisher] = useState(null); // domain string

  // Apply theme to <html> for CSS to react to.
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  const toggleSaved = useCallback(
    (article) => {
      setSaved((prev) => {
        const exists = prev.some((a) => a.url === article.url);
        return exists ? prev.filter((a) => a.url !== article.url) : [{ ...article, savedAt: Date.now() }, ...prev];
      });
    },
    [setSaved]
  );

  const isSaved = useCallback((url) => saved.some((a) => a.url === url), [saved]);

  // Opening a publisher page replaces the reader (it's a context switch).
  const openPublisher = useCallback((domain) => {
    if (!domain) return;
    setActiveArticle(null);
    setActivePublisher(domain);
  }, []);

  const toggleMute = useCallback(
    (domain) => {
      if (!domain) return;
      setMuted((prev) => (prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]));
    },
    [setMuted]
  );
  const isMuted = useCallback((domain) => muted.includes(domain), [muted]);

  if (!topics) {
    return <Onboarding onDone={(picked) => setTopics(picked)} />;
  }

  return (
    <div className="app">
      <main className="app-main">
        {tab === "today" && (
          <Feed
            topics={topics}
            onOpen={setActiveArticle}
            onToggleSave={toggleSaved}
            isSaved={isSaved}
            onOpenPublisher={openPublisher}
            mutedDomains={muted}
          />
        )}
        {tab === "search" && (
          <Search
            topics={topics}
            onOpen={setActiveArticle}
            onToggleSave={toggleSaved}
            isSaved={isSaved}
            onOpenPublisher={openPublisher}
            mutedDomains={muted}
          />
        )}
        {tab === "saved" && (
          <Saved
            saved={saved}
            onOpen={setActiveArticle}
            onToggleSave={toggleSaved}
            isSaved={isSaved}
            onOpenPublisher={openPublisher}
          />
        )}
        {tab === "settings" && (
          <Settings
            topics={topics}
            onChangeTopics={setTopics}
            theme={theme}
            onChangeTheme={setTheme}
            onOpenPublisher={openPublisher}
            muted={muted}
            onToggleMute={toggleMute}
          />
        )}
      </main>

      <TabBar active={tab} onChange={setTab} savedCount={saved.length} />

      {activePublisher && (
        <Publisher
          domain={activePublisher}
          onOpenArticle={setActiveArticle}
          onToggleSave={toggleSaved}
          isSaved={isSaved}
          onClose={() => setActivePublisher(null)}
          muted={isMuted(activePublisher)}
          onToggleMute={toggleMute}
        />
      )}

      {activeArticle && (
        <Reader
          article={activeArticle}
          onClose={() => setActiveArticle(null)}
          onToggleSave={toggleSaved}
          isSaved={isSaved(activeArticle.url)}
          onOpenPublisher={openPublisher}
        />
      )}
    </div>
  );
}
