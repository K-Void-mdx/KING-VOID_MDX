import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  extractFailureJid,
  FailureCounter,
  resolveSessionFiles,
  healSessions,
  createLoggerHook,
  MAX_HEALS_PER_JID,
} from '../src/core/session-healer.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'nova-sesh-'));
}

function touch(path, data = '{}') {
  writeFileSync(path, data);
  return path;
}

test('extractFailureJid prefers sender, then author, then key.remoteJid', () => {
  assert.equal(
    extractFailureJid({ sender: '2345@s.whatsapp.net', author: '9@s.whatsapp.net', key: { remoteJid: '9@s.whatsapp.net' } }),
    '2345@s.whatsapp.net'
  );
  assert.equal(
    extractFailureJid({ author: '148417661669464@lid', key: {} }),
    '148417661669464@lid'
  );
  assert.equal(
    extractFailureJid({ key: { remoteJid: '999@g.us' } }),
    '999@g.us'
  );
  assert.equal(extractFailureJid({}), null);
  assert.equal(extractFailureJid({ author: 'no-domain' }), null);
});

test('FailureCounter heals only after the threshold of failures per jid', () => {
  const c = new FailureCounter({ threshold: 3, maxHeals: 2 });
  assert.equal(c.record('a'), 'held');
  assert.equal(c.record('a'), 'held');
  assert.equal(c.record('a'), 'heal');
  assert.equal(c.healsFor('a'), 1);
  // state resets after a heal, so a new burst heals again
  assert.equal(c.record('a'), 'held');
  assert.equal(c.record('a'), 'held');
  assert.equal(c.record('a'), 'heal');
  assert.equal(c.healsFor('a'), 2);
  // after maxHeals, further failures are skipped (no more deletes)
  assert.equal(c.record('a'), 'skipped');
  // independent jids are tracked independently
  assert.equal(c.record('b'), 'held');
});

test('resolveSessionFiles finds the plain jid and device-suffixed records', async () => {
  const dir = tempDir();
  try {
    // session files are keyed by the contact's bare number, device-suffixed
    touch(join(dir, 'session-2345_1.0.json'));
    touch(join(dir, 'session-2345_123.99.json'));
    touch(join(dir, 'session-other_1.0.json'));
    touch(join(dir, 'identity-key-2345_1.0.json')); // not a session record
    const files = await resolveSessionFiles({ authDir: dir, jid: '2345@s.whatsapp.net' });
    assert.ok(files.includes('session-2345_1.0.json'), 'plain session found');
    assert.ok(files.includes('session-2345_123.99.json'), 'device-suffixed found');
    assert.ok(!files.includes('session-other_1.0.json'), 'other jid untouched');
    assert.ok(!files.includes('identity-key-2345_1.0.json'), 'identity keys untouched');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveSessionFiles maps a PN to its LID via reverse mapping', async () => {
  const dir = tempDir();
  try {
    // lid-mapping-<PN>_reverse.json records the contact's LID
    touch(join(dir, 'lid-mapping-2347046855205_reverse.json'), '"148417661669464"');
    touch(join(dir, 'session-148417661669464_1.0.json'));
    touch(join(dir, 'session-148417661669464_129.99.json'));
    const files = await resolveSessionFiles({ authDir: dir, jid: '2347046855205@s.whatsapp.net' });
    assert.ok(files.includes('session-148417661669464_1.0.json'), 'session via LID found');
    assert.ok(files.includes('session-148417661669464_129.99.json'), 'device variant via LID found');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('healSessions removes stale records and reports them', async () => {
  const dir = tempDir();
  try {
    touch(join(dir, 'session-148417661669464_1.0.json'));
    touch(join(dir, 'identity-key-148417661669464_1.0.json'));
    touch(join(dir, 'lid-mapping-2347046855205_reverse.json'), '"148417661669464"');
    const log = [];
    const removed = await healSessions({ authDir: dir, jid: '2347046855205@s.whatsapp.net', log: (m) => log.push(m) });
    assert.ok(removed.includes('session-148417661669464_1.0.json'));
    assert.ok(!existsSync(join(dir, 'session-148417661669464_1.0.json')), 'session gone');
    assert.ok(existsSync(join(dir, 'identity-key-148417661669464_1.0.json')), 'identity key preserved');
    assert.ok(log.some((m) => m.includes('SESSION-HEAL')), 'heal action logged');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('createLoggerHook wires a pino logger to auto-heal on repeated decrypt failures', async () => {
  const dir = tempDir();
  try {
    touch(join(dir, 'session-2345_1.0.json'));
    const realErrors = [];
    const fakePino = {
      error: (...args) => { realErrors.push(args); },
    };
    const { logger, hooked } = createLoggerHook({ logger: fakePino, authDir: dir });
    assert.equal(hooked, true);

    // non-decrypt errors pass through untouched and never trigger a heal
    logger.error({ some: 'thing' }, 'random error');
    assert.equal(existsSync(join(dir, 'session-2345_1.0.json')), true);

    // threshold (3) decrypt failures for the same jid → heal fires
    for (let i = 0; i < 3; i++) {
      await logger.error(
        { sender: '2345@s.whatsapp.net', key: { remoteJid: '2345@s.whatsapp.net' }, err: new Error('Bad MAC') },
        'failed to decrypt message'
      );
    }
    assert.equal(existsSync(join(dir, 'session-2345_1.0.json')), false, 'stale session purged after repeat failures');
    // 1 non-heal call + 3 decrypt failures all reached the real logger
    assert.equal(realErrors.length, 4, 'real logger still received all errors');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('createLoggerHook respects max heals per jid (no unbounded deletes)', async () => {
  const dir = tempDir();
  try {
    const { logger, tracker } = createLoggerHook({ logger: { error: () => {} }, authDir: dir });
    const record = tracker.record.bind(tracker);
    assert.equal(record('x'), 'held');
    assert.equal(record('x'), 'held');
    assert.equal(record('x'), 'heal');
    assert.ok(tracker.healsFor('x') <= MAX_HEALS_PER_JID);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
