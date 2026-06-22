// Article sharing — produces a short, clean link that opens the article inside
// The Brief (reader mode, paywall unlocked), so recipients get the app experience.

export function articleShareUrl(article) {
  // Only the article URL, percent-encoded (encodeURIComponent uses %20, never "+"),
  // so the result is a single clean clickable link with no spaces.
  return `${location.origin}/?u=${encodeURIComponent(article.url)}`;
}

// Parse a shared link on app load → an article object (or null).
export function parseSharedArticle() {
  const params = new URLSearchParams(location.search);
  const url = params.get("u");
  if (!url) return null;
  let domain = "";
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* leave blank */
  }
  return { url, title: "", source: domain, domain, publishedAt: null };
}

function toast(message) {
  window.dispatchEvent(new CustomEvent("brief:toast", { detail: message }));
}

// Copy text reliably: async Clipboard API (HTTPS) → legacy execCommand fallback.
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
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
      if (err && err.name === "AbortError") return; // user cancelled
      // otherwise fall through to copy
    }
  }

  const copied = await copyToClipboard(url);
  if (copied) {
    toast("Link copied");
  } else {
    // Last resort: surface the link so the user can copy it manually.
    window.prompt("Copy this link:", url);
  }
}
