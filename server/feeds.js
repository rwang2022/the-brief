// Topic catalog and their free RSS sources.
//
// Each topic mixes FREE outlets with PREMIUM/paywalled ones — broad, Apple-News-style
// coverage. Feeds flagged `paywalled: true` get an "unlock" badge and route through the
// paywall-bypass reader. `domain` is the publisher's homepage host (for the favicon +
// publisher pages). Only feeds with working public RSS are included — AP and Reuters
// discontinued public RSS, so they're not available here.

export const TOPICS = [
  {
    id: "nyc",
    label: "NYC Local",
    emoji: "🗽",
    feeds: [
      { source: "Gothamist", domain: "gothamist.com", url: "https://gothamist.com/feed" },
      { source: "The City", domain: "thecity.nyc", url: "https://www.thecity.nyc/rss/" },
      { source: "amNewYork", domain: "amny.com", url: "https://www.amny.com/feed/" },
      { source: "NY Post Metro", domain: "nypost.com", url: "https://nypost.com/metro/feed/" },
      { source: "Eater NY", domain: "eater.com", url: "https://ny.eater.com/rss/index.xml" },
      { source: "Brooklyn Paper", domain: "brooklynpaper.com", url: "https://www.brooklynpaper.com/feed/" },
      { source: "NY Mag Intelligencer", domain: "nymag.com", url: "https://nymag.com/rss/Intelligencer.xml", paywalled: true },
      { source: "The New Yorker", domain: "newyorker.com", url: "https://www.newyorker.com/feed/news", paywalled: true },
      { source: "NYT New York", domain: "nytimes.com", url: "https://rss.nytimes.com/services/xml/rss/nyt/NYRegion.xml", paywalled: true },
    ],
  },
  {
    id: "sports",
    label: "Sports",
    emoji: "🏀",
    feeds: [
      { source: "ESPN", domain: "espn.com", url: "https://www.espn.com/espn/rss/news" },
      { source: "Yahoo Sports", domain: "sports.yahoo.com", url: "https://sports.yahoo.com/rss/" },
      { source: "CBS Sports", domain: "cbssports.com", url: "https://www.cbssports.com/rss/headlines/" },
      { source: "SB Nation", domain: "sbnation.com", url: "https://www.sbnation.com/rss/index.xml" },
      { source: "Guardian Sport", domain: "theguardian.com", url: "https://www.theguardian.com/uk/sport/rss" },
      { source: "Guardian Football", domain: "theguardian.com", url: "https://www.theguardian.com/football/rss" },
    ],
  },
  {
    id: "tech",
    label: "Tech",
    emoji: "💻",
    feeds: [
      { source: "The Verge", domain: "theverge.com", url: "https://www.theverge.com/rss/index.xml" },
      { source: "Ars Technica", domain: "arstechnica.com", url: "https://feeds.arstechnica.com/arstechnica/index" },
      { source: "TechCrunch", domain: "techcrunch.com", url: "https://techcrunch.com/feed/" },
      { source: "Engadget", domain: "engadget.com", url: "https://www.engadget.com/rss.xml" },
      { source: "Wired", domain: "wired.com", url: "https://www.wired.com/feed/rss", paywalled: true },
      { source: "MIT Tech Review", domain: "technologyreview.com", url: "https://www.technologyreview.com/feed/", paywalled: true },
    ],
  },
  {
    id: "world",
    label: "World",
    emoji: "🌍",
    feeds: [
      { source: "BBC World", domain: "bbc.com", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
      { source: "Al Jazeera", domain: "aljazeera.com", url: "https://www.aljazeera.com/xml/rss/all.xml" },
      { source: "NPR World", domain: "npr.org", url: "https://feeds.npr.org/1004/rss.xml" },
      { source: "Guardian World", domain: "theguardian.com", url: "https://www.theguardian.com/world/rss" },
      { source: "CNN", domain: "cnn.com", url: "http://rss.cnn.com/rss/cnn_topstories.rss" },
      { source: "NBC News", domain: "nbcnews.com", url: "https://feeds.nbcnews.com/nbcnews/public/news" },
      { source: "CBS News", domain: "cbsnews.com", url: "https://www.cbsnews.com/latest/rss/main" },
      { source: "ABC News", domain: "abcnews.go.com", url: "https://abcnews.go.com/abcnews/topstories" },
      { source: "NYT World", domain: "nytimes.com", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", paywalled: true },
      { source: "Washington Post World", domain: "washingtonpost.com", url: "https://feeds.washingtonpost.com/rss/world", paywalled: true },
      { source: "The Economist", domain: "economist.com", url: "https://www.economist.com/international/rss.xml", paywalled: true },
    ],
  },
  {
    id: "politics",
    label: "Politics",
    emoji: "🏛️",
    feeds: [
      { source: "NPR Politics", domain: "npr.org", url: "https://feeds.npr.org/1014/rss.xml" },
      { source: "The Hill", domain: "thehill.com", url: "https://thehill.com/rss/syndicator/19110" },
      { source: "Politico", domain: "politico.com", url: "https://rss.politico.com/politics-news.xml" },
      { source: "CBS News Politics", domain: "cbsnews.com", url: "https://www.cbsnews.com/latest/rss/politics" },
      { source: "NBC News Politics", domain: "nbcnews.com", url: "https://feeds.nbcnews.com/nbcnews/public/politics" },
      { source: "Fox News Politics", domain: "foxnews.com", url: "https://moxie.foxnews.com/google-publisher/politics.xml" },
      { source: "ABC News Politics", domain: "abcnews.go.com", url: "https://abcnews.go.com/abcnews/politicsheadlines" },
      { source: "Guardian US Politics", domain: "theguardian.com", url: "https://www.theguardian.com/us-news/us-politics/rss" },
      { source: "NYT Politics", domain: "nytimes.com", url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", paywalled: true },
      { source: "Washington Post Politics", domain: "washingtonpost.com", url: "https://feeds.washingtonpost.com/rss/politics", paywalled: true },
    ],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    emoji: "🎬",
    feeds: [
      { source: "Variety", domain: "variety.com", url: "https://variety.com/feed/" },
      { source: "The Hollywood Reporter", domain: "hollywoodreporter.com", url: "https://www.hollywoodreporter.com/feed/" },
      { source: "NPR Pop Culture", domain: "npr.org", url: "https://feeds.npr.org/1008/rss.xml" },
      { source: "Rolling Stone", domain: "rollingstone.com", url: "https://www.rollingstone.com/feed/" },
      { source: "Pitchfork", domain: "pitchfork.com", url: "https://pitchfork.com/feed/feed-news/rss" },
      { source: "Guardian Culture", domain: "theguardian.com", url: "https://www.theguardian.com/culture/rss" },
      { source: "LA Times Entertainment", domain: "latimes.com", url: "https://www.latimes.com/entertainment-arts/rss2.0.xml", paywalled: true },
      { source: "NYT Arts", domain: "nytimes.com", url: "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml", paywalled: true },
    ],
  },
  {
    id: "business",
    label: "Business",
    emoji: "📈",
    feeds: [
      { source: "CNBC", domain: "cnbc.com", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147" },
      { source: "MarketWatch", domain: "marketwatch.com", url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
      { source: "Fortune", domain: "fortune.com", url: "https://fortune.com/feed/" },
      { source: "Yahoo Finance", domain: "finance.yahoo.com", url: "https://finance.yahoo.com/news/rssindex" },
      { source: "Business Insider", domain: "businessinsider.com", url: "https://www.businessinsider.com/rss", paywalled: true },
      { source: "Bloomberg", domain: "bloomberg.com", url: "https://feeds.bloomberg.com/markets/news.rss", paywalled: true },
      { source: "WSJ Markets", domain: "wsj.com", url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", paywalled: true },
      { source: "NYT Business", domain: "nytimes.com", url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", paywalled: true },
      { source: "Financial Times", domain: "ft.com", url: "https://www.ft.com/rss/home", paywalled: true },
    ],
  },
  {
    id: "science",
    label: "Science",
    emoji: "🔬",
    feeds: [
      { source: "NPR Science", domain: "npr.org", url: "https://feeds.npr.org/1007/rss.xml" },
      { source: "Ars Science", domain: "arstechnica.com", url: "https://feeds.arstechnica.com/arstechnica/science" },
      { source: "Quanta", domain: "quantamagazine.org", url: "https://api.quantamagazine.org/feed/" },
      { source: "Guardian Science", domain: "theguardian.com", url: "https://www.theguardian.com/science/rss" },
      { source: "Nature", domain: "nature.com", url: "https://www.nature.com/nature.rss" },
      { source: "Scientific American", domain: "scientificamerican.com", url: "https://www.scientificamerican.com/platform/syndication/rss/", paywalled: true },
      { source: "New Scientist", domain: "newscientist.com", url: "https://www.newscientist.com/feed/home/", paywalled: true },
    ],
  },
];

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

// Umbrella brand names for publishers that span several section feeds.
const PUBLISHER_NAMES = {
  "nytimes.com": "The New York Times",
  "theguardian.com": "The Guardian",
  "npr.org": "NPR",
  "arstechnica.com": "Ars Technica",
  "washingtonpost.com": "The Washington Post",
  "wsj.com": "The Wall Street Journal",
  "bbc.com": "BBC News",
  "sports.yahoo.com": "Yahoo Sports",
  "cbsnews.com": "CBS News",
  "nbcnews.com": "NBC News",
  "foxnews.com": "Fox News",
  "abcnews.go.com": "ABC News",
  "latimes.com": "Los Angeles Times",
  "nymag.com": "New York Magazine",
};

// All feeds across every topic that belong to a publisher (by domain).
export function feedsForDomain(domain) {
  const result = [];
  for (const topic of TOPICS) {
    for (const feed of topic.feeds) {
      if (feed.domain === domain) {
        result.push({ topicId: topic.id, topicLabel: topic.label, paywalled: false, ...feed });
      }
    }
  }
  return result;
}

// Publisher display info for a domain — brand name + whether it's paywalled.
export function publisherInfo(domain) {
  const feeds = feedsForDomain(domain);
  let name = PUBLISHER_NAMES[domain];
  if (!name && feeds[0]) name = feeds[0].source; // single-feed publishers: source IS the brand
  return {
    domain,
    name: name || domain,
    paywalled: feeds.some((f) => f.paywalled),
    sections: feeds.map((f) => f.topicLabel),
  };
}

// Flatten the feeds for a set of topic ids, tagging each with its topic + source.
export function feedsForTopics(topicIds) {
  const result = [];
  for (const id of topicIds) {
    const topic = TOPIC_BY_ID[id];
    if (!topic) continue;
    for (const feed of topic.feeds) {
      result.push({ topicId: topic.id, topicLabel: topic.label, paywalled: false, ...feed });
    }
  }
  return result;
}

// Public-facing catalog (no feed URLs) for onboarding + the About source list.
export function topicCatalog() {
  return TOPICS.map((t) => ({
    id: t.id,
    label: t.label,
    emoji: t.emoji,
    sources: t.feeds.map((f) => ({
      source: f.source,
      domain: f.domain,
      paywalled: Boolean(f.paywalled),
    })),
  }));
}
