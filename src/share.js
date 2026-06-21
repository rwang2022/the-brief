// Article sharing — produces a link that opens the article inside The Brief
// (reader mode, paywall unlocked), so recipients get the app experience.

export function articleShareUrl(article) {
  const p = new URLSearchParams();
  p.set("u", article.url);
  if (article.title) p.set("t", article.title);
  if (article.source) p.set("s", article.source);
  if (article.domain) p.set("d", article.domain);
  return `${location.origin}/?${p.toString()}`;
}

// Parse a shared link on app load → an article object (or null).
export function parseSharedArticle() {
  const p = new URLSearchParams(location.search);
  const url = p.get("u");
  if (!url) return null;
  return {
    url,
    title: p.get("t") || "",
    source: p.get("s") || p.get("d") || "",
    domain: p.get("d") || "",
    publishedAt: null,
  };
}

function toast(message) {
  window.dispatchEvent(new CustomEvent("brief:toast", { detail: message }));
}

// Share via the native share sheet where available, else copy the link.
export async function shareArticle(article) {
  const url = articleShareUrl(article);
  const title = article.title || "The Brief";

  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // user cancelled — do nothing
      // otherwise fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied");
  } catch {
    toast("Couldn't copy link");
  }
}
