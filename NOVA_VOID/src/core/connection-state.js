export const STATES = [
  'starting',
  'awaiting_number',
  'connecting',
  'awaiting_pair',
  'pairing',
  'online',
  'reconnecting',
  'logged_out',
  'stopped',
];

const ALLOWED = {
  starting: ['awaiting_number', 'connecting', 'stopped'],
  awaiting_number: ['connecting', 'stopped'],
  connecting: ['awaiting_pair', 'online', 'reconnecting', 'stopped'],
  awaiting_pair: ['pairing', 'reconnecting', 'logged_out', 'stopped'],
  pairing: ['online', 'reconnecting', 'logged_out', 'stopped'],
  online: ['reconnecting', 'logged_out', 'stopped'],
  reconnecting: ['connecting', 'stopped'],
  logged_out: ['starting'],
  stopped: [],
};

export function canTransition(from, to) {
  return (ALLOWED[from] ?? []).includes(to);
}

/**
 * Decide how a closed connection should be handled from its Baileys status code.
 * Codes verified against the installed baileys 7.0.0-rc13 DisconnectReason:
 *   401 loggedOut, 403 forbidden, 408 lost/timedOut, 411 multideviceMismatch,
 *   428 connectionClosed, 440 connectionReplaced, 500 badSession,
 *   503 unavailableService, 515 restartRequired.
 * Non-protocol codes (e.g. HTTP 405 from a rejected WS upgrade) fall through
 * to "retry" — they are transport problems, not auth problems.
 */
export function classifyDisconnect(statusCode) {
  switch (statusCode) {
    case 401:
      return { action: 'stop', reason: 'logged_out' };
    case 403:
      return { action: 'stop', reason: 'forbidden' };
    case 440:
      return { action: 'stop', reason: 'connection_replaced' };
    case 515:
      return { action: 'restart', reason: 'restart_required' };
    default:
      return { action: 'retry', reason: statusCode == null ? 'unknown' : String(statusCode) };
  }
}

/** Capped exponential backoff: 3s, 5s, 10s, then 15s forever. Attempt starts at 1. */
export function nextBackoffMs(attempt = 1) {
  const steps = [3000, 5000, 10000];
  const index = Math.min(Math.max(attempt, 1), steps.length + 1) - 1;
  return index < steps.length ? steps[index] : 15000;
}

/** Fires the wrapped send exactly once per process, no matter how often called. */
export function createOnlineNotifier(send) {
  let sent = false;
  return function notifyOnce() {
    if (sent) return false;
    if (typeof send !== 'function') return false;
    sent = true;
    send();
    return true;
  };
}

/** Pure decision so tests cover both boot modes without touching readline. */
export function decideStartMode(registered) {
  return registered ? { mode: 'restore' } : { mode: 'interactive' };
}
