// Thin client for the backend API.

async function json(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function getTopics() {
  return fetch("/api/topics").then(json);
}

export function getFeed(topicIds) {
  const q = encodeURIComponent(topicIds.join(","));
  return fetch(`/api/feed?topics=${q}`).then(json);
}

export function getSummaries(articles) {
  return fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      articles: articles.map((a) => ({
        url: a.url,
        title: a.title,
        source: a.source,
        snippet: a.snippet,
      })),
    }),
  }).then(json);
}

export function getArticle(url) {
  return fetch(`/api/article?url=${encodeURIComponent(url)}`).then(json);
}

export function getPublisher(domain) {
  return fetch(`/api/publisher?domain=${encodeURIComponent(domain)}`).then(json);
}
