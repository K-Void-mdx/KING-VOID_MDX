import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canTransition,
  classifyDisconnect,
  nextBackoffMs,
  createOnlineNotifier,
  decideStartMode,
} from '../src/core/connection-state.js';
import { normalizePhone, maskPhone } from '../src/core/phone.js';
import * as ui from '../src/ui/banner.js';
import { smallCaps } from '../src/ui/wa-style.js';

// ---- phone normalization ----

test('normalizePhone strips formatting, +, and whitespace', () => {
  assert.equal(normalizePhone('+234 704 685 5205').phone, '2347046855205');
  assert.equal(normalizePhone('(234) 801-234-5678').phone, '2348012345678');
  assert.equal(normalizePhone('  1 555 010 2030 ').phone, '15550102030');
});

test('normalizePhone rejects empty input — there is NO hidden default number', () => {
  // The pairing number comes ONLY from the operator's typed answer; even if
  // someone passes a stray argument it must never be used as a fallback.
  assert.equal(normalizePhone('').ok, false);
  assert.equal(normalizePhone('   ').ok, false);
  assert.equal(normalizePhone(null).ok, false);
});

test('normalizePhone rejects garbage, short numbers, and empty-with-no-default', () => {
  assert.equal(normalizePhone('abc123').ok, false);
  assert.equal(normalizePhone('12345').ok, false);
  assert.equal(normalizePhone('').ok, false);
  assert.match(normalizePhone('abc123').error, /not a valid number/);
});

test('maskPhone only ever reveals the last four digits', () => {
  assert.equal(maskPhone('2347046855205'), '*********5205');
  assert.equal(maskPhone('1234'), '****');
});

// ---- connection lifecycle ----

test('classifyDisconnect stops for permanent auth failures, retries transient403', () => {
  assert.deepEqual(classifyDisconnect(401), { action: 'stop', reason: 'logged_out' });
  assert.deepEqual(classifyDisconnect(440), { action: 'stop', reason: 'connection_replaced' });
  //403 is transient (session may be in use by another device); caller bounds retries.
  assert.deepEqual(classifyDisconnect(403), { action: 'retry', reason: 'forbidden' });
});

test('classifyDisconnect restarts on 515 and retries transport errors (incl. HTTP 405)', () => {
  assert.deepEqual(classifyDisconnect(515), { action: 'restart', reason: 'restart_required' });
  for (const code of [undefined, 405, 408, 428, 500, 503]) {
    assert.equal(classifyDisconnect(code).action, 'retry', `code ${code}`);
  }
});

test('backoff escalates then caps at 15s', () => {
  assert.deepEqual([1, 2, 3, 4, 10].map(nextBackoffMs), [3000, 5000, 10000, 15000, 15000]);
});

test('state machine forbids illegal transitions and allows real ones', () => {
  assert.ok(canTransition('connecting', 'online'));
  assert.ok(canTransition('online', 'reconnecting'));
  assert.ok(canTransition('reconnecting', 'connecting'));
  assert.ok(canTransition('awaiting_pair', 'pairing'));
  assert.ok(!canTransition('online', 'awaiting_pair'));
  assert.ok(!canTransition('stopped', 'starting'));
});

test('decideStartMode restores sessions and prompts fresh installs', () => {
  assert.deepEqual(decideStartMode(true), { mode: 'restore' });
  assert.deepEqual(decideStartMode(false), { mode: 'interactive' });
});

test('online notifier fires exactly once no matter how often called', () => {
  let sends = 0;
  const notify = createOnlineNotifier(() => { sends += 1; });
  assert.equal(notify(), true);
  assert.equal(notify(), false);
  assert.equal(notify(), false);
  assert.equal(sends, 1);
  assert.equal(createOnlineNotifier(undefined)(), false);
});

// ---- startup UI ----

test('banner art spells NOVA VOID MDX correctly', () => {
  const plain = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const banner = plain(ui.novaBanner());
  const identity = plain(ui.identityBlock());
  assert.match(banner, /██╗   ██╗/); // V column present
  assert.equal(banner.split('\n').length, 20); // 3 blocks of 6 rows + 2 blank separators
  assert.match(identity, /NOVA/);
  assert.match(identity, /VOID  -  MDX/);
  assert.match(plain(ui.titleCard()), /NOVA_VOID MDX v3\.0/);
});

test('pairing box renders the code exactly as delivered by WhatsApp', () => {
  const box = ui.pairingCodeBox('ABCD-1234');
  assert.match(box, /│        ABCD-1234            │/);
  assert.match(box, /Link with phone number instead/);
});

test('connected screen reports identity without leaking credentials', () => {
  const screen = ui.connectedScreen({ botJid: '509…@s.whatsapp.net', commands: 12, seconds: '4.2' });
  assert.match(screen, /CONNECTED SUCCESSFULLY/);
  assert.match(screen, /Commands loaded \(12\)/);
  assert.match(screen, /4\.2s/);
  assert.doesNotMatch(screen, /private|key|creds/i);
});

test('online message is branded, honest, and lists quick-start commands', () => {
  const msg = ui.onlineMessage('NOVA_VOID MDX', '.', 11);
  assert.match(msg, /⚡ \*_NOVA_VOID MDX_\* ⚡/);
  assert.match(msg, /SYSTEM ONLINE/);
  assert.match(msg, /Status.*: `ONLINE`/);
  assert.match(msg, /Prefix.*: `\.`/);
  assert.doesNotMatch(msg, /AI (is )?(configured|connected)/i);
  for (const cmd of ['.ᴘɪɴɢ', '.ᴍᴇɴᴜ', '.ꜱᴛᴀᴛᴜꜱ']) {
    assert.ok(msg.includes(`\`${cmd}\``), `missing ${cmd}`);
  }
});

test('smallCaps converts command names to WhatsApp small-caps', () => {
  assert.equal(smallCaps('ping'), 'ᴘɪɴɢ');
  assert.equal(smallCaps('menu'), 'ᴍᴇɴᴜ');
  assert.equal(smallCaps('status'), 'ꜱᴛᴀᴛᴜꜱ');
  assert.equal(smallCaps('ai'), 'ᴀɪ');
  assert.equal(smallCaps('generate'), 'ɢᴇɴᴇʀᴀᴛᴇ');
  assert.equal(smallCaps('history'), 'ʜɪꜱᴛᴏʀʏ');
  assert.equal(smallCaps('clear-h'), 'ᴄʟᴇᴀʀ-ʜ');
  assert.equal(smallCaps('-'), '-');
});

// ---- message pipeline regressions (live-test failures) ----

import { normalizeMessage, unwrapMessage } from '../src/core/message/normalize.js';
import { bareJid, maskJid, isBroadcastChat } from '../src/core/jid.js';
import { sendWithRetry } from '../src/core/send-retry.js';
import { installLogGuard } from '../src/core/log-guard.js';

test('bareJid strips device suffixes used by linked companions', () => {
  assert.equal(bareJid('2347046855205:6@s.whatsapp.net'), '2347046855205@s.whatsapp.net');
  assert.equal(bareJid('2347046855205@s.whatsapp.net'), '2347046855205@s.whatsapp.net');
});

test('maskJid never reveals a full number', () => {
  const masked = maskJid('2347046855205:6@s.whatsapp.net');
  assert.ok(masked.includes('***'));
  assert.ok(!masked.includes('2347046855205'));
});

test('isBroadcastChat covers status and newsletter broadcast variants', () => {
  assert.equal(isBroadcastChat('status@broadcast'), true);
  assert.equal(isBroadcastChat('status@distributed'), true);
  assert.equal(isBroadcastChat('123@newsletter'), false);
  assert.equal(isBroadcastChat('2347046855205@s.whatsapp.net'), false);
});

test('normalize unwraps ephemeral and view-once wrappers to reach text', () => {
  const wrapped = {
    key: { id: 'A', remoteJid: '2347046855205@s.whatsapp.net', fromMe: true },
    message: { ephemeralMessage: { message: { conversation: '.ping' } } },
  };
  assert.equal(normalizeMessage(wrapped).text, '.ping');

  const viewOnce = {
    key: { id: 'B', remoteJid: '2347046855205@s.whatsapp.net' },
    message: { viewOnceMessageV2: { message: { extendedTextMessage: { text: 'hello bot' } } } },
  };
  assert.equal(normalizeMessage(viewOnce).text, 'hello bot');
  assert.deepEqual(unwrapMessage({ viewOnceMessage: { message: { conversation: 'x' } } }).wrapped, true);
});

test('normalize flags protocol/reaction noise', () => {
  const proto = {
    key: { id: 'C', remoteJid: '2347046855205@s.whatsapp.net' },
    message: { protocolMessage: { type: 0 } },
  };
  assert.equal(normalizeMessage(proto).isProtocol, true);
});

test('normalize extracts the pressed button id from interactive responses', () => {
  const press = {
    key: { id: 'D', remoteJid: '1203@g.us', participant: '2348000000002@s.whatsapp.net' },
    message: {
      interactiveResponseMessage: {
        nativeFlowResponseMessage: {
          name: 'quick_reply',
          paramsJson: JSON.stringify({ id: 'copy_code_abc123' }),
          displayText: '📋 COPY CODE',
        },
      },
    },
  };
  const msg = normalizeMessage(press);
  assert.equal(msg.buttonId, 'copy_code_abc123');
  assert.equal(msg.text, '');
  assert.equal(msg.isProtocol, false);
});

test('normalize leaves buttonId null for ordinary text', () => {
  const normal = {
    key: { id: 'E', remoteJid: '1203@g.us' },
    message: { conversation: 'hello bot' },
  };
  assert.equal(normalizeMessage(normal).buttonId, null);
});

test('sendWithRetry succeeds once, retries failures, and throws only after all attempts', async () => {
  let calls = 0;
  const ok = await sendWithRetry(async () => { calls += 1; return 'sent'; }, { sleep: async () => {} });
  assert.equal(ok, 'sent');
  assert.equal(calls, 1);

  let failures = 0;
  await assert.rejects(
    sendWithRetry(async () => { failures += 1; throw new Error(`boom ${failures}`); }, { attempts: 3, sleep: async () => {} })
  );
  assert.equal(failures, 3);
});

test('log guard suppresses libsignal session dumps but keeps normal logs', () => {
  const lines = [];
  const fake = {
    info: (...a) => lines.push(['info', ...a]),
    log: (...a) => lines.push(['log', ...a]),
    debug: () => {},
    warn: (...a) => lines.push(['warn', ...a]),
    error: (...a) => lines.push(['error', ...a]),
  };
  const guard = installLogGuard(fake);
  const secret = { type: 'SessionEntry', privKey: Buffer.alloc(32) };
  fake.info('Closing session:', secret);
  fake.info('normal operational line');
  assert.equal(lines.length, 1);
  assert.equal(guard.suppressed, 1);
  assert.equal(lines[0][1], 'normal operational line');
  guard.restore();
});


// ---- WA protocol version cache ----

import { parseCachedVersion, loadWaVersion, VERSION_TTL_MS } from '../src/core/version-cache.js';

test('parseCachedVersion accepts only well-formed fresh records', () => {
  const now = 1_000_000_000;
  const good = JSON.stringify({ version: [2, 3000, 1043857760], fetchedAt: now });
  assert.deepEqual(parseCachedVersion(good, now), [2, 3000, 1043857760]);
  assert.equal(parseCachedVersion(good, now + VERSION_TTL_MS + 1), undefined);
  assert.equal(parseCachedVersion('{broken'), undefined);
  assert.equal(parseCachedVersion(JSON.stringify({ version: ['a', 'b', 'c'], fetchedAt: now })), undefined);
  assert.equal(parseCachedVersion(JSON.stringify({ version: [2, 3000], fetchedAt: now })), undefined);
});

test('loadWaVersion prefers cache, fetches once when stale, falls back on failure', async () => {
  const calls = [];
  const fetchVersion = async () => { calls.push(1); return { version: [9, 9, 9] }; };
  const file = { value: JSON.stringify({ version: [1, 1, 1], fetchedAt: Date.now() }) };
  const io = {
    readFile: async () => file.value,
    writeFile: async (_p, data) => { file.value = data; },
  };

  const cached = await loadWaVersion({ file: 'x', fetchVersion, io });
  assert.deepEqual(cached.version, [1, 1, 1]);
  assert.equal(cached.source, 'cache');
  assert.equal(calls.length, 0);

  const expired = await loadWaVersion({
    file: 'x',
    fetchVersion,
    ttl: -1,
    io,
  });
  assert.deepEqual(expired.version, [9, 9, 9]);
  assert.equal(expired.source, 'network');
  assert.equal(calls.length, 1);
  assert.deepEqual(parseCachedVersion(file.value).slice(), [9, 9, 9]);

  const failed = await loadWaVersion({
    file: 'x',
    fetchVersion: async () => { throw new Error('offline'); },
    ttl: -1,
    io,
  });
  assert.equal(failed.version, undefined);
  assert.equal(failed.source, 'fallback');
});

// ---- online notification dedup gate ----

import { createOnlineGate } from '../src/core/online-gate.js';

test('online gate allows exactly one send cycle and never re-sends after success', () => {
  const gate = createOnlineGate();
  assert.equal(gate.state, 'idle');
  assert.equal(gate.begin(), true, 'first open may send');
  assert.equal(gate.begin(), false, 'concurrent open must not duplicate');
  assert.equal(gate.begin(), false);
  gate.success();
  assert.equal(gate.state, 'sent');
  assert.equal(gate.begin(), false, 'no resend after confirmed success');
});

test('online gate returns to idle after a fully failed cycle so a healthy retry can happen', () => {
  const gate = createOnlineGate();
  gate.begin();
  gate.failure();
  assert.equal(gate.state, 'idle');
  assert.equal(gate.begin(), true);
});

// ─── Process lock tests ───────────────────────────────────────────────────────

import { join } from 'node:path';
import { writeFile, readFile, unlink as unlinkFs, rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

test('stale lock file with dead PID is reclaimable', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lock-'));
  const lockFile = join(dir, 'NOVA_VOID.lock');
  await writeFile(lockFile, JSON.stringify({ pid: 999999999, ts: Date.now() }), 'utf8');
  const lock = JSON.parse(await readFile(lockFile, 'utf8'));
  let pidAlive = false;
  try { process.kill(lock.pid, 0); pidAlive = true; } catch { pidAlive = false; }
  assert.equal(pidAlive, false, 'stale lock PID should be dead');
  await unlinkFs(lockFile);
  await rm(dir, { recursive: true, force: true });
});

test('active lock with live PID blocks startup', async () => {
  const lockData = JSON.stringify({ pid: process.pid, ts: Date.now() });
  const parsed = JSON.parse(lockData);
  assert.equal(parsed.pid, process.pid);
  assert.equal(typeof parsed.ts, 'number');
  // process.kill(self, 0) always succeeds → lock would be "alive"
  let alive = false;
  try { process.kill(parsed.pid, 0); alive = true; } catch { alive = false; }
  assert.equal(alive, true, 'current process PID is always alive');
});

// ─── Interactive pairing contract (owner ≠ bot pairing account) ─────────────

test('pairing screen asks for the number with NO configured default', () => {
  const plain = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const screen = plain(ui.authRequiredScreen());
  assert.match(screen, /Enter the WhatsApp number to link as NOVA_VOID MDX\./);
  assert.match(screen, /Include country code without \+ or spaces\./);
  assert.match(screen, /Example: 2348012345678/);
  assert.doesNotMatch(screen, /Press Enter/i);
  assert.doesNotMatch(screen, /configured number/i);
  assert.doesNotMatch(screen, /50932528446/); // the old owner must never resurface here
  assert.equal(ui.PAIRING_PROMPT, 'Number: ');
});

test('fresh-pairing mode banner matches the required wording', () => {
  const screen = ui.freshPairingScreen().replace(/\x1b\[[0-9;]*m/g, '');
  assert.match(screen, /\[ MODE \] Fresh pairing required/);
});

// ─── Pairing gate: code requested ONLY at the qr-ready stage ────────────────

import { shouldRequestPairingCode } from '../src/core/pairing-gate.js';

test('pairing code may be requested only for qr updates of unregistered sessions with a number', () => {
  const ok = { registered: false, hasPhone: true };
  assert.equal(shouldRequestPairingCode({ qr: 'QRDATA' }, ok), true);
  // Not ready / wrong context:
  assert.equal(shouldRequestPairingCode({ connection: 'open' }, ok), false, 'no qr yet');
  assert.equal(shouldRequestPairingCode({}, ok), false);
  assert.equal(shouldRequestPairingCode(undefined, ok), false);
  assert.equal(shouldRequestPairingCode({ qr: 'QRDATA' }, { registered: true, hasPhone: true }), false,
    'registered sessions must never request codes');
  assert.equal(shouldRequestPairingCode({ qr: 'QRDATA' }, { registered: false, hasPhone: false }), false,
    'no operator number → nothing to request against');
});

// ─── Reconnect scheduler: one timer, stale generations never fire ───────────

import { createReconnectScheduler } from '../src/core/reconnect-scheduler.js';

function fakeTimers() {
  const armed = new Map();
  let seq = 0;
  return {
    fired: [],
    set(fn) { const id = ++seq; armed.set(id, fn); return id; },
    clear(id) { armed.delete(id); },
    runAll() { for (const fn of [...armed.values()]) fn(); armed.clear(); },
    get size() { return armed.size; },
  };
}

test('scheduler keeps exactly ONE pending timer (reschedule cancels the old)', () => {
  const timers = fakeTimers();
  let fires = 0;
  const sched = createReconnectScheduler({ timers, onFire: () => { fires += 1; } });
  sched.schedule(1000);
  assert.equal(sched.pending, true);
  assert.equal(timers.size, 1);
  sched.schedule(2000); // second schedule must cancel the first handle
  assert.equal(timers.size, 1, 'still exactly one armed timer');
  timers.runAll();
  assert.equal(fires, 1, 'only the newest callback fires');
});

test('scheduler.cancel prevents fire and orphans already-detached callbacks', () => {
  const timers = fakeTimers();
  let fires = 0;
  const sched = createReconnectScheduler({ timers, onFire: () => { fires += 1; } });
  sched.schedule(500);
  const before = sched.generation;
  sched.cancel();
  assert.equal(sched.pending, false);
  assert.ok(sched.generation > before, 'cancel bumps generation');
  timers.runAll();
  assert.equal(fires, 0, 'cancelled timer must never fire');
});

test('a stale scheduled callback cannot double-fire after reschedule', () => {
  const timers = fakeTimers();
  let fires = 0;
  const sched = createReconnectScheduler({ timers, onFire: () => { fires += 1; } });
  sched.schedule(10);
  // grab the FIRST callback reference, then supersede it
  sched.schedule(20);
  sched.schedule(30);
  timers.runAll();
  assert.equal(fires, 1);
});

// ─── Online notification destination ────────────────────────────────────────

import { ownerNotificationTarget } from '../src/core/jid.js';

test('online card targets the bare CONFIGURED owner JID in every config form', () => {
  assert.equal(ownerNotificationTarget(['2347046855205@s.whatsapp.net']), '2347046855205@s.whatsapp.net');
  assert.equal(ownerNotificationTarget(['2347046855205:6@s.whatsapp.net']),
    '2347046855205@s.whatsapp.net', 'device suffix stripped');
  assert.equal(ownerNotificationTarget(['2347046855205']),
    '2347046855205@s.whatsapp.net', 'bare digits gain the domain');
  assert.equal(ownerNotificationTarget([]), '', 'nothing configured → no target');
  assert.equal(ownerNotificationTarget(['', null]), '');
});

// ─── Startup state machine: confirmed-invalid path + no input-time loops ────

test('confirmed-invalid sessions may clear into fresh pairing; temporary ones may not', () => {
  // connecting / pairing / online → clearing_session → awaiting_number
  assert.ok(canTransition('connecting', 'clearing_session'));
  assert.ok(canTransition('awaiting_pair', 'clearing_session'));
  assert.ok(canTransition('pairing', 'clearing_session'));
  assert.ok(canTransition('online', 'clearing_session'));
  assert.ok(canTransition('clearing_session', 'awaiting_number'));

  // While WAITING FOR THE OPERATOR'S NUMBER nothing may reconnect behind
  // their back — awaiting_number has no edge into connecting-adjacent loops.
  assert.ok(!canTransition('awaiting_number', 'reconnecting'));
  assert.ok(!canTransition('awaiting_number', 'clearing_session'));
  assert.ok(canTransition('awaiting_number', 'connecting'), 'only an explicit submit connects');
});
