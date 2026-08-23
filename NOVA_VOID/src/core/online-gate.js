/**
 * Once-per-process gate for the startup/online notification.
 *
 * idle -> sending (exactly one winner, even if several sockets open at once)
 * sending -> sent     (confirmed delivery; never again this process)
 * sending -> idle     (whole retry cycle failed; a later connection may retry)
 */
export function createOnlineGate() {
  let state = 'idle';
  return {
    get state() {
      return state;
    },
    begin() {
      if (state !== 'idle') return false;
      state = 'sending';
      return true;
    },
    success() {
      if (state === 'sending') state = 'sent';
    },
    failure() {
      if (state === 'sending') state = 'idle';
    },
  };
}
