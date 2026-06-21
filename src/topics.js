// Static mirror of the server topic catalog labels, so filter pills can render
// without an extra round-trip. Kept in sync with server/feeds.js.

export const TOPIC_LABELS = {
  nyc: "NYC Local",
  sports: "Sports",
  tech: "Tech",
  world: "World",
  politics: "Politics",
  entertainment: "Entertainment",
  business: "Business",
  science: "Science",
};

export const TOPIC_EMOJI = {
  nyc: "🗽",
  sports: "🏀",
  tech: "💻",
  world: "🌍",
  politics: "🏛️",
  entertainment: "🎬",
  business: "📈",
  science: "🔬",
};
