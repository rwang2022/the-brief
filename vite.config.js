import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The React frontend runs on :5173 and proxies /api to the Express backend on :3001.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Bind all interfaces so the dev server is reachable from your phone over
    // LAN or Tailscale (not just localhost). allowedHosts:true lets it answer
    // requests by IP/hostname (e.g. a Tailscale name or Funnel URL).
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
