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

// ---- phone normalization ----

test('normalizePhone strips formatting, +, and whitespace', () => {
  assert.equal(normalizePhone('+509 3252-8446').phone, '50932528446');
  assert.equal(normalizePhone('(234) 801-234-5678').phone, '2348012345678');
  assert.equal(normalizePhone('  1 555 010 2030 ').phone, '15550102030');
});

test('normalizePhone falls back to the configured default on empty input', () => {
  const result = normalizePhone('', '50932528446');
  assert.ok(result.ok);
  assert.equal(result.phone, '50932528446');
});

test('normalizePhone rejects garbage, short numbers, and empty-with-no-default', () => {
  assert.equal(normalizePhone('abc123').ok, false);
  assert.equal(normalizePhone('12345').ok, false);
  assert.equal(normalizePhone('').ok, false);
  assert.match(normalizePhone('abc123').error, /not a valid number/);
});

test('maskPhone only ever reveals the last four digits', () => {
  assert.equal(maskPhone('50932528446'), '*******8446');
  assert.equal(maskPhone('1234'), '****');
});

// ---- connection lifecycle ----

test('classifyDisconnect stops for auth-level failures', () => {
  assert.deepEqual(classifyDisconnect(401), { action: 'stop', reason: 'logged_out' });
  assert.deepEqual(classifyDisconnect(403), { action: 'stop', reason: 'forbidden' });
  assert.deepEqual(classifyDisconnect(440), { action: 'stop', reason: 'connection_replaced' });
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
  const banner = ui.novaBanner();
  assert.match(banner, /██╗   ██╗/); // V column present
  assert.equal(banner.split('\n').length, 20); // 3 blocks of 6 rows + 2 blank separators
  assert.match(ui.identityBlock(), /NOVA/);
  assert.match(ui.identityBlock(), /VOID  -  MDX/);
  assert.match(ui.titleCard(), /NOVA_VOID MDX v3\.0/);
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

test('online message is branded and lists quick-start commands once per process', () => {
  const msg = ui.onlineMessage('NOVA_VOID MDX');
  assert.match(msg, /NOVA_VOID MDX/);
  assert.match(msg, /IS NOW ONLINE/);
  for (const cmd of ['.ping', '.menu', '.status', '.chatbot on']) {
    assert.ok(msg.includes(cmd), `missing ${cmd}`);
  }
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
