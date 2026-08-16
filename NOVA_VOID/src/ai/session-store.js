export class AISessionStore {
  #sessions = new Map();
  #maxMessages;

  constructor({ maxMessages = 40 } = {}) {
    this.#maxMessages = Math.max(1, Number(maxMessages) || 40);
  }

  #key(userJid, scope = 'private') {
    const user = String(userJid ?? '').trim().toLowerCase();
    const context = String(scope ?? 'private').trim().toLowerCase();
    if (!user) throw new TypeError('A session user id is required');
    return `${context}:${user}`;
  }

  get(userJid, scope = 'private') {
    const session = this.#sessions.get(this.#key(userJid, scope));
    return session ? this.#clone(session) : null;
  }

  ensure(userJid, scope = 'private') {
    const key = this.#key(userJid, scope);
    let session = this.#sessions.get(key);
    if (!session) {
      session = {
        userJid: String(userJid).trim().toLowerCase(),
        scope: String(scope).trim().toLowerCase(),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.#sessions.set(key, session);
    }
    return this.#clone(session);
  }

  append(userJid, message, scope = 'private') {
    const key = this.#key(userJid, scope);
    const session = this.#sessions.get(key) ?? this.#create(userJid, scope, key);
    session.messages.push({ ...message, timestamp: new Date().toISOString() });
    if (session.messages.length > this.#maxMessages) {
      session.messages.splice(0, session.messages.length - this.#maxMessages);
    }
    session.updatedAt = new Date().toISOString();
    return this.#clone(session);
  }

  history(userJid, scope = 'private') {
    return this.ensure(userJid, scope).messages;
  }

  clear(userJid, scope = 'private') {
    return this.#sessions.delete(this.#key(userJid, scope));
  }

  clearAll() {
    const count = this.#sessions.size;
    this.#sessions.clear();
    return count;
  }

  size() {
    return this.#sessions.size;
  }

  #create(userJid, scope, key) {
    const session = {
      userJid: String(userJid).trim().toLowerCase(),
      scope: String(scope).trim().toLowerCase(),
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

export const sessionStore = new AISessionStore();

export const getSessionKey = (jid, scope = 'private') => `${scope}:${String(jid).trim().toLowerCase()}`;
export const getHistory = (jid, scope = 'private') => sessionStore.history(jid, scope);
export const ensureSession = (jid, scope = 'private') => sessionStore.ensure(jid, scope);
export const appendHistory = (jid, message, scope = 'private') => sessionStore.append(jid, message, scope);
export const clearHistory = (jid, scope = 'private') => sessionStore.clear(jid, scope);
export const clearAllHistory = () => sessionStore.clearAll();
export const sessionCount = () => sessionStore.size();
