export class AIMemoryStore {
  #records = new Map();

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
    this.#records.set(key, records);
    return { ...record };
  }

  remove(ownerJid, id, scope = 'bot') {
    const key = this.#key(ownerJid, scope);
    const records = this.#records.get(key) ?? [];
    const next = records.filter((item) => item.id !== id);
    this.#records.set(key, next);
    return next.length !== records.length;
  }

  clear(ownerJid, scope = 'bot') {
    return this.#records.delete(this.#key(ownerJid, scope));
  }
}
