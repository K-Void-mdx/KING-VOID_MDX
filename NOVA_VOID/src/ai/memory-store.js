import { loadJson, saveJson, capArray } from '../core/storage/json-store.js';

const MAX_RECORDS_PER_KEY = 200;

/**
 * Persistent training knowledge ("what the bot was taught").
 * Scope "global" entries (owner-authorized) are injected into every AI chat;
 * per-user scopes stay private to their owner. Deliberately separate from
 * conversation history: .clear-h must never touch it.
 * Pass filePath to persist; omit for in-memory use (tests).
 */
export class AIMemoryStore {
  #records = new Map();
  #filePath;

  constructor({ filePath } = {}) {
    this.#filePath = filePath;
    const saved = loadJson(filePath, { records: {} });
    if (saved?.records && typeof saved.records === 'object') {
      for (const [key, list] of Object.entries(saved.records)) {
        if (Array.isArray(list)) this.#records.set(key, list);
      }
    }
  }

  #key(ownerJid, scope = 'bot') {
    return `${scope}:${String(ownerJid).trim().toLowerCase()}`;
  }

  list(ownerJid, scope = 'bot') {
    return [...(this.#records.get(this.#key(ownerJid, scope)) ?? [])].map((item) => ({ ...item }));
  }

  add(ownerJid, content, { scope = 'bot', source = 'train' } = {}) {
    if (!String(content).trim()) throw new TypeError('Memory content cannot be empty');
    const key = this.#key(ownerJid, scope);
    const records = this.#records.get(key) ?? [];
    const record = { id: crypto.randomUUID(), content: String(content).trim(), source, createdAt: Date.now() };
    records.push(record);
    capArray(records, MAX_RECORDS_PER_KEY);
    this.#records.set(key, records);
    this.#persist();
    return { ...record };
  }

  /** All records across owners for a scope (used for global bot knowledge). */
  listAll(scope = 'global') {
    const prefix = `${String(scope).trim().toLowerCase()}:`;
    const all = [];
    for (const [key, list] of this.#records) {
      if (key.startsWith(prefix)) for (const item of list) all.push({ ...item });
    }
    return all;
  }

  remove(ownerJid, id, scope = 'bot') {
    const key = this.#key(ownerJid, scope);
    const records = this.#records.get(key) ?? [];
    const next = records.filter((item) => item.id !== id);
    this.#records.set(key, next);
    if (next.length !== records.length) this.#persist();
    return next.length !== records.length;
  }

  clear(ownerJid, scope = 'bot') {
    const removed = this.#records.delete(this.#key(ownerJid, scope));
    if (removed) this.#persist();
    return removed;
  }

  #persist() {
    saveJson(this.#filePath, { records: Object.fromEntries(this.#records) });
  }
}
