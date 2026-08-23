import { readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { loadJson, saveJson } from '../core/storage/json-store.js';

function sessionFileName(key) {
  return `${Buffer.from(key).toString('base64url')}.json`;
}

/**
 * Bounded per-scope conversation sessions.
 * Pass dirPath to persist each session as its own JSON file under it
 * (bounded by maxMessages). Omit for in-memory use (tests).
 */
export class AISessionStore {
  #sessions = new Map();
  #maxMessages;
  #dirPath;

  constructor({ maxMessages = 40, dirPath } = {}) {
    this.#maxMessages = Math.max(1, Number(maxMessages) || 40);
    this.#dirPath = dirPath;
  }

  #key(userJid, scope = 'private') {
    const user = String(userJid ?? '').trim().toLowerCase();
    if (!user) throw new TypeError('A session user id is required');
    const context = String(scope ?? 'private').trim().toLowerCase() || 'private';
    return `${context}:${user}`;
  }

  get(userJid, scope = 'private') {
    const key = this.#key(userJid, scope);
    const session = this.#sessions.get(key) ?? this.#load(key);
    return session ? this.#clone(session) : null;
  }

  ensure(userJid, scope = 'private') {
    const key = this.#key(userJid, scope);
    return this.#clone(this.#sessions.get(key) ?? this.#load(key) ?? this.#create(userJid, scope, key));
  }

  append(userJid, message, scope = 'private') {
    const key = this.#key(userJid, scope);
    const session = this.#sessions.get(key) ?? this.#load(key) ?? this.#create(userJid, scope, key);
    session.messages.push({ ...message, timestamp: new Date().toISOString() });
    if (session.messages.length > this.#maxMessages) {
      session.messages.splice(0, session.messages.length - this.#maxMessages);
    }
    session.updatedAt = new Date().toISOString();
    saveJson(this.#dirPath ? join(this.#dirPath, sessionFileName(key)) : undefined, session);
    return this.#clone(session);
  }

  history(userJid, scope = 'private') {
    return this.ensure(userJid, scope).messages;
  }

  clear(userJid, scope = 'private') {
    const key = this.#key(userJid, scope);
    const existed = this.#sessions.delete(key);
    if (this.#dirPath) {
      try { unlinkSync(join(this.#dirPath, sessionFileName(key))); } catch { /* already gone */ }
    }
    return existed;
  }

  clearAll() {
    let count = this.#sessions.size;
    if (this.#dirPath) {
      let files = [];
      try { files = readdirSync(this.#dirPath).filter((f) => f.endsWith('.json')); } catch { /* no dir yet */ }
      for (const file of files) {
        try { unlinkSync(join(this.#dirPath, file)); count += 1; } catch { /* ignore */ }
      }
    }
    count = Math.max(count, this.#sessions.size);
    this.#sessions.clear();
    return count;
  }

  size() {
    return this.#sessions.size;
  }

  #load(key) {
    if (!this.#dirPath) return null;
    const saved = loadJson(join(this.#dirPath, sessionFileName(key)), null);
    if (!saved || !Array.isArray(saved.messages)) return null;
    saved.messages = saved.messages.slice(-this.#maxMessages);
    this.#sessions.set(key, saved);
    return saved;
  }

  #create(userJid, scope, key) {
    const session = {
      userJid: String(userJid).trim().toLowerCase(),
      scope: String(scope ?? 'private').trim().toLowerCase() || 'private',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.#sessions.set(key, session);
    return session;
  }

  #clone(session) {
    return { ...session, messages: session.messages.map((message) => ({ ...message })) };
  }
}

export const getSessionKey = (jid, scope = 'private') =>
  `${String(scope ?? 'private').trim().toLowerCase() || 'private'}:${String(jid).trim().toLowerCase()}`;
