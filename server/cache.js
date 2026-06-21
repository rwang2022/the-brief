// Tiny TTL cache with optional disk persistence.
// Used for: parsed feeds (short TTL), AI summaries (long TTL), reader content (medium TTL).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", ".cache");

export class Cache {
  /**
   * @param {object} opts
   * @param {number} opts.ttl  Time-to-live in ms.
   * @param {string} [opts.persistTo]  Filename inside .cache to persist to.
   */
  constructor({ ttl, persistTo } = {}) {
    this.ttl = ttl ?? 5 * 60 * 1000;
    this.persistTo = persistTo;
    this.map = new Map(); // key -> { value, expires }
    this._dirty = false;
    if (persistTo) this._load();
  }

  async _load() {
    try {
      const raw = await readFile(join(CACHE_DIR, this.persistTo), "utf8");
      const entries = JSON.parse(raw);
      const now = Date.now();
      for (const [key, entry] of Object.entries(entries)) {
        if (entry.expires > now) this.map.set(key, entry);
      }
    } catch {
      // No cache file yet — fine.
    }
  }

  async _flush() {
    if (!this.persistTo || !this._dirty) return;
    this._dirty = false;
    try {
      await mkdir(CACHE_DIR, { recursive: true });
      const obj = Object.fromEntries(this.map.entries());
      await writeFile(join(CACHE_DIR, this.persistTo), JSON.stringify(obj));
    } catch (err) {
      console.warn("[cache] flush failed:", err.message);
    }
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttl = this.ttl) {
    this.map.set(key, { value, expires: Date.now() + ttl });
    this._dirty = true;
    // Debounced persistence so we don't write on every set.
    if (this.persistTo) {
      clearTimeout(this._flushTimer);
      this._flushTimer = setTimeout(() => this._flush(), 1000);
    }
    return value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }
}
