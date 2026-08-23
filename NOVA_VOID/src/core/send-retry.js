/**
 * Calls `send` up to `attempts` times (default 3), waiting delayMs between
 * tries. Returns the first successful result. The caller learns success only
 * via resolution — never mark "sent" flags before this resolves.
 */
export async function sendWithRetry(send, { attempts = 3, delayMs = 2000, sleep = defaultSleep } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
    try {
      return await send(attempt);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw lastError ?? new Error('send failed');
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
