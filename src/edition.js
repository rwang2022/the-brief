// Client-side storage for the downloaded Edition. The small meta lives in
// localStorage (for a quick "is it fresh?" check); the full bundle — 15 articles
// with their baked-in reader HTML — goes into the Cache Storage API so it isn't
// bound by the ~5MB localStorage ceiling. Falls back to localStorage if the
// Cache API is unavailable (older browsers, some private modes).

const META_KEY = "brief.edition.meta";
const CACHE_NAME = "the-brief-edition";
const BUNDLE_KEY = "/__edition__"; // synthetic request key inside the cache
const LS_BUNDLE_KEY = "brief.edition.bundle"; // fallback only

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function readMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isEditionFresh(meta = readMeta()) {
  return Boolean(meta && meta.date === today());
}

export async function saveEdition(bundle) {
  const meta = {
    date: bundle.date || today(),
    count: bundle.count ?? (bundle.articles || []).length,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* meta is tiny; ignore quota */
  }

  const json = JSON.stringify(bundle);
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(
        BUNDLE_KEY,
        new Response(json, { headers: { "Content-Type": "application/json" } })
      );
      try {
        localStorage.removeItem(LS_BUNDLE_KEY);
      } catch {
        /* ignore */
      }
      return meta;
    } catch {
      /* fall through to localStorage */
    }
  }
  try {
    localStorage.setItem(LS_BUNDLE_KEY, json);
  } catch {
    /* bundle too big for localStorage and no Cache API — meta stays, load() will refetch */
  }
  return meta;
}

export async function loadEdition() {
  if (typeof caches !== "undefined") {
    try {
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match(BUNDLE_KEY);
      if (res) return await res.json();
    } catch {
      /* fall through */
    }
  }
  try {
    const raw = localStorage.getItem(LS_BUNDLE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

export async function clearEdition() {
  try {
    localStorage.removeItem(META_KEY);
    localStorage.removeItem(LS_BUNDLE_KEY);
  } catch {
    /* ignore */
  }
  if (typeof caches !== "undefined") {
    try {
      await caches.delete(CACHE_NAME);
    } catch {
      /* ignore */
    }
  }
}
