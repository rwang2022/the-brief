// Dev entrypoint. Forces the API onto its own port (default 3001) so it never
// collides with the Vite dev server — some launchers inject a PORT env var
// pointing at the web port, which would otherwise make Express try to bind it.
// Production uses `npm start` → server/index.js directly and honours the host PORT.
process.env.PORT = process.env.API_PORT || "3001";
await import("./index.js");
