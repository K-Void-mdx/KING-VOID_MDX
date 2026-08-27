import { readdir, unlink, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Signal session auto-healer.
 *
 * WhatsApp E2EE messages are decrypted using per-contact signal "session"
 * records persisted under data/auth/session-*.json. Occasionally those records
 * fall out of sync with WhatsApp servers — the phone re-encrypts with a session
 * it considers current while the linked device holds the old one — producing a
 * "Bad MAC"/decrypt failure for every message from that contact. Unlike the
 * "No session record" case (which Baileys retries automatically), a corrupt
 * existing session is NOT healed by Baileys, so those messages (DMs and group
 * @mentions) are silently lost forever.
 *
 * We hook the pino logger we hand Baileys. When it reports repeated
 * "failed to decrypt message" errors for the same remote jid, we delete that
 * contact's stale session record(s). WhatsApp then re-establishes a fresh
 * session on the next message, restoring delivery. Session records are
 * re-generable, so removing a corrupt one is safe — it causes at most a one
 * message re-sync, never a data loss of the account.
 *
 * Pure helper functions are exported for unit testing; createLoggerHook wires
 * them to the live pino logger + filesystem.
 */

const DECRYPT_FAILURE_MARKER = 'failed to decrypt message';
// Guard rails so we never delete broadly, only a clearly broken record.
export const MAX_FAIL_BEFORE_HEAL = 3;
// A jid that keeps failing forever must not spam delete attempts.
const MAX_HEALS_PER_JID = 3;

function isDecryptFailureMessage(message) {
  return typeof message === 'string' && message.includes(DECRYPT_FAILURE_MARKER);
}

/** Returns the remote jid responsible for a decrypt failure, if identifiable. */
export function extractFailureJid(errorContext = {}) {
  const key = errorContext.key ?? {};
  const candidates = [errorContext.sender, errorContext.author, key.remoteJid];
  for (const c of candidates) {
    if (typeof c === 'string' && c.includes('@')) return c;
  }
  return null;
}

/** Strips device suffix → `2345X@whatsapp.net` / `XXXX@lid`. */
function baseJid(jid = '') {
  return String(jid).toLowerCase().replace(/:\d+(?=@)/, '');
}

/**
 * Files a new failure for a jid. Returns true when the accumulated failures for
 * that jid have just crossed the heal threshold.
 */
export class FailureCounter {
  #counts = new Map();
  #heals = new Map();
  #threshold;
  #maxHeals;

  constructor({ threshold = MAX_FAIL_BEFORE_HEAL, maxHeals = MAX_HEALS_PER_JID } = {}) {
    this.#threshold = threshold;
    this.#maxHeals = maxHeals;
  }

  /**
   * Returns 'heal' when this failure should trigger a session heal, 'held' when
   * it was counted but not yet critical, and 'skipped' when the jid has already
   * been healed the max number of times this process.
   */
  record(jid) {
    if (!jid) return 'skipped';
    if ((this.#heals.get(jid) ?? 0) >= this.#maxHeals) return 'skipped';
    const count = (this.#counts.get(jid) ?? 0) + 1;
    this.#counts.set(jid, count);
    if (count >= this.#threshold) {
      this.#counts.delete(jid); // reset for the next burst
      this.#heals.set(jid, (this.#heals.get(jid) ?? 0) + 1);
      return 'heal';
    }
    return 'held';
  }

  healsFor(jid) {
    return this.#heals.get(jid) ?? 0;
  }
}

/**
 * Resolves the session record filenames that could belong to a jid.
 * Session files are keyed by the contact's bare number (the LID in modern
 * Baileys — e.g. session-148417661669464_1.0.json), possibly with a device
 * suffix. We collect the contact's numbers (the jid's own base plus its
 * PN→LID resolution from lid-mapping-<PN>_reverse.json) and match every
 * session-* file whose key begins with one of them.
 */
export async function resolveSessionFiles({ authDir, jid }) {
  const numbers = new Set();
  const base = baseJid(jid);
  if (!base) return [];

  const ownNumber = base.split('@')[0];
  if (ownNumber) numbers.add(ownNumber);

  // A PN jid also carries a LID, recorded in lid-mapping-<PN>_reverse.json.
  if (base.endsWith('whatsapp.net') || base.endsWith('lid')) {
    const lidNum = await readLidForPn(authDir, ownNumber);
    if (lidNum) numbers.add(lidNum);
  }

  const files = await readdir(authDir).catch(() => []);
  const wanted = new Set();
  for (const file of files) {
    if (!file.startsWith('session-') || !file.endsWith('.json')) continue;
    const rest = file.slice('session-'.length, -'.json'.length);
    const restNumber = rest.split(/[_.:]+/)[0];
    if (numbers.has(restNumber)) wanted.add(file);
  }
  return [...wanted];
}

/** Read the LID number recorded in data/auth/lid-mapping-<PN>_reverse.json. */
async function readLidForPn(authDir, pn) {
  const reverseFile = join(authDir, `lid-mapping-${pn}_reverse.json`);
  try {
    const raw = await readFile(reverseFile, 'utf8');
    const lid = JSON.parse(raw);
    if (typeof lid === 'string' && lid) return String(lid).split('@')[0];
  } catch { /* missing mapping — fall through */ }
  return null;
}

/**
 * Removes stale session records for a jid. Returns the names actually removed.
 * Non-destructive for anything that is not a session record.
 */
export async function healSessions({ authDir, jid, log = () => {} }) {
  const files = await resolveSessionFiles({ authDir, jid });
  const removed = [];
  for (const file of files) {
    const full = join(authDir, file);
    try {
      await unlink(full);
      removed.push(file);
    } catch (error) {
      log(`[ SESSION-HEAL ] could not remove ${file}: ${error?.message ?? error}`);
    }
  }
  if (removed.length) {
    log(`[ SESSION-HEAL ] cleared ${removed.length} stale session record(s) for ${jid}: ${removed.join(', ')}`);
  }
  return removed;
}

/**
 * Wraps a pino-style logger so decrypt failures are counted and — once a jid
 * crosses the threshold — its stale signal sessions are purged. Returns the
 * wrapped logger plus a diagnostic handle for tests.
 */
export function createLoggerHook({ logger, authDir, counter, log = console.error }) {
  const tracker = counter ?? new FailureCounter();
  const originalError = logger?.error?.bind ? logger.error.bind(logger) : null;
  if (!originalError) {
    return { logger: logger ?? console, tracker, hooked: false };
  }

  const wrapped = Object.create(logger);
  wrapped.error = async (...args) => {
    try {
      if (isDecryptFailureMessage(args[1])) {
        const failureJid = extractFailureJid(args[0]);
        if (failureJid && tracker.record(failureJid) === 'heal') {
          await healSessions({ authDir, jid: failureJid, log });
        }
      }
    } catch (error) {
      // Healing must never break the transport.
      log(`[ SESSION-HEAL ] hook error: ${error?.message ?? error}`);
    }
    return originalError(...args);
  };

  return { logger: wrapped, tracker, hooked: true };
}

export { MAX_HEALS_PER_JID };
