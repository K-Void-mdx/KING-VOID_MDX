const sessions = new Map();

function keyFor(sessionId) {
  return String(sessionId ?? '').trim().toLowerCase();
}

export function getSessionKey(jid) {
  return keyFor(jid);
}

export function getHistory(jid) {
  return [...(sessions.get(keyFor(jid)) ?? [])];
}

export function ensureSession(jid) {
  const key = keyFor(jid);
  if (!key) throw new TypeError('A session id is required');
  if (!sessions.has(key)) sessions.set(key, []);
  return getHistory(key);
}

export function appendHistory(jid, message) {
  const key = keyFor(jid);
  if (!key) return;
  const history = sessions.get(key) ?? [];
  history.push({ ...message, timestamp: new Date().toISOString() });
  // Keep in-memory context bounded. Persistent storage can replace this later.
  if (history.length > 40) history.splice(0, history.length - 40);
  sessions.set(key, history);
}

export function clearHistory(jid) {
  sessions.delete(keyFor(jid));
}

export function clearAllHistory() {
  sessions.clear();
}

export function sessionCount() {
  return sessions.size;
}
