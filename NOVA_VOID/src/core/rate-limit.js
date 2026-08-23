/**
 * Lightweight fixed-window rate limiter. No dependencies.
 * Protects AI quotas, mobile data and the bot from flooding.
 */
export class RateLimiter {
  #hits = new Map();
  #windowMs;
  #max;

  constructor({ windowMs = 10_000, max = 3 } = {}) {
    this.#windowMs = Math.max(250, Number(windowMs) || 10_000);
    this.#max = Math.max(1, Number(max) || 1);
  }

  /** Returns true when the action is allowed; records the hit. */
  allow(key) {
    const now = Date.now();
    this.#prune(now);
    const entry = this.#hits.get(key);
    if (entry && entry.count >= this.#max && now < entry.resetAt) return false;
    if (!entry || now >= entry.resetAt) {
      this.#hits.set(key, { count: 1, resetAt: now + this.#windowMs });
      return true;
    }
    entry.count += 1;
    return true;
  }

  msUntilAllowed(key) {
    const entry = this.#hits.get(String(key));
    if (!entry) return 0;
    return Math.max(0, entry.resetAt - Date.now());
  }

  reset(key) {
    this.#hits.delete(String(key));
  }

  #prune(now) {
    if (this.#hits.size < 500) return;
    for (const [key, entry] of this.#hits) {
      if (now >= entry.resetAt) this.#hits.delete(key);
    }
  }
}
