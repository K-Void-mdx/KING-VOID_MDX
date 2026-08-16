const sessions = new Map();

export function getSessionKey(jid) {
  return String(jid ?? '').trim().toLowerCase();
}

export function getHistory(jid) {
  return [...(sessions.get(getSessionKey(jid)) ?? [])];
}

export function appendHistory(jid, message) {
  const key = getSessionKey(jid);
  if (!key) return;
  const history = sessions.get(key) ?? [];
  history.push(message);
  // Keep the runtime context bounded; persistent storage will be added later.
  if (history.length > 40) history.splice(0, history.length - 40);
  sessions.set(key, history);
}

export function clearHistory(jid) {
  sessions.delete(getSessionKey(jid));
}

export function clearAllHistory() {
  sessions.clear();
}
