import { loadJson, saveJson } from '../storage/json-store.js';

/**
 * Chatbot toggle state. Per-chat scope.
 * Pass filePath to persist across restarts; omit for in-memory use (tests).
 */
export class ChatbotState {
  #enabled = new Set();
  #filePath;

  constructor({ filePath } = {}) {
    this.#filePath = filePath;
    const saved = loadJson(filePath, { enabledByChat: [] });
    if (Array.isArray(saved?.enabledByChat)) {
      for (const chat of saved.enabledByChat) this.#enabled.add(String(chat).toLowerCase());
    }
  }

  isEnabled(chatJid) {
    return this.#enabled.has(String(chatJid).toLowerCase());
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
    saveJson(this.#filePath, { enabledByChat: [...this.#enabled] });
  }
}
