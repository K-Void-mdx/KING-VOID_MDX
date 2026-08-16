export class ChatbotState {
  #enabled = new Set();

  isEnabled(chatJid) {
    return this.#enabled.has(String(chatJid).toLowerCase());
  }

  set(chatJid, enabled) {
    const key = String(chatJid).toLowerCase();
    if (enabled) this.#enabled.add(key);
    else this.#enabled.delete(key);
    return enabled;
  }
}
