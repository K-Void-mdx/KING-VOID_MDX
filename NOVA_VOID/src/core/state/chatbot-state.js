import { loadJson, saveJson } from '../storage/json-store.js';

/**
 * Chatbot toggle state. Supports global mode (all chats) and per-chat overrides.
 * Pass filePath to persist across restarts; omit for in-memory use (tests).
 */
export class ChatbotState {
  #enabled = new Set();
  #globalEnabled = false;
  #filePath;

  constructor({ filePath } = {}) {
    this.#filePath = filePath;
    const saved = loadJson(filePath, { global: false, enabledByChat: [] });
    this.#globalEnabled = Boolean(saved?.global);
    if (Array.isArray(saved?.enabledByChat)) {
      for (const chat of saved.enabledByChat) this.#enabled.add(String(chat).toLowerCase());
    }
  }

  isEnabled(chatJid) {
    if (this.#globalEnabled) return true;
    return this.#enabled.has(String(chatJid).toLowerCase());
  }

  isGlobal() {
    return this.#globalEnabled;
  }

  setGlobal(enabled) {
    this.#globalEnabled = Boolean(enabled);
    this.#persist();
    return this.#globalEnabled;
  }

  set(chatJid, enabled) {
    const key = String(chatJid).toLowerCase();
    if (enabled) this.#enabled.add(key);
    else this.#enabled.delete(key);
    this.#persist();
    return enabled;
  }

  list() {
    return [...this.#enabled];
  }

  #persist() {
    saveJson(this.#filePath, {
      global: this.#globalEnabled,
      enabledByChat: [...this.#enabled],
    });
  }
}
