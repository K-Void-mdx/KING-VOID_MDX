import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseCommand } from '../src/core/commands/parse.js';
import { normalizeMessage } from '../src/core/message/normalize.js';
import { isChatbotTrigger } from '../src/ai/chatbot.js';
import { AISessionStore } from '../src/ai/session-store.js';
import { AIMemoryStore } from '../src/ai/memory-store.js';
import { ChatbotState } from '../src/core/state/chatbot-state.js';
import { RateLimiter } from '../src/core/rate-limit.js';
import { hasRole } from '../src/core/permissions/roles.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'nova-test-'));
}

test('parses dot commands and arguments', () => {
  assert.deepEqual(parseCommand('.ai hello world'), {
    prefix: '.',
    name: 'ai',
    args: ['hello', 'world'],
    text: 'hello world',
  });
});

test('normalizes mentions and quoted replies', () => {
  const message = normalizeMessage({
    key: { id: '1', remoteJid: '123@g.us', participant: '456@s.whatsapp.net' },
    message: { extendedTextMessage: { text: '@bot hi', contextInfo: { mentionedJid: ['bot@s.whatsapp.net'], participant: 'bot@s.whatsapp.net', stanzaId: '2' } } },
  }, { botJid: 'bot@s.whatsapp.net' });
  assert.equal(message.chatJid, '123@g.us');
  assert.equal(message.senderJid, '456@s.whatsapp.net');
  assert.equal(message.isGroup, true);
  assert.equal(isChatbotTrigger(message, 'bot@s.whatsapp.net'), true);
});

test('does not trigger chatbot on ordinary messages', () => {
  const message = normalizeMessage({ key: { id: '1', remoteJid: '123@g.us', participant: '456@s.whatsapp.net' }, message: { conversation: 'hello everyone' } });
  assert.equal(isChatbotTrigger(message, 'bot@s.whatsapp.net'), false);
});

test('AI session history is bounded and clearable', () => {
  const sessions = new AISessionStore({ maxMessages: 2 });
  sessions.append('user@s.whatsapp.net', { role: 'user', content: 'one' });
  sessions.append('user@s.whatsapp.net', { role: 'assistant', content: 'two' });
  sessions.append('user@s.whatsapp.net', { role: 'user', content: 'three' });
  assert.deepEqual(sessions.history('user@s.whatsapp.net').map((item) => item.content), ['two', 'three']);
  assert.equal(sessions.clear('user@s.whatsapp.net'), true);
});

test('sessions persist to disk and survive a store restart', () => {
  const dir = join(tempDir(), 'history');
  const first = new AISessionStore({ maxMessages: 5, dirPath: dir });
  first.append('user@s.whatsapp.net', { role: 'user', content: 'remember me' }, 'chat');

  const second = new AISessionStore({ maxMessages: 5, dirPath: dir });
  assert.deepEqual(second.history('user@s.whatsapp.net', 'chat').map((m) => m.content), ['remember me']);

  second.clearAll();
  const third = new AISessionStore({ maxMessages: 5, dirPath: dir });
  assert.equal(third.history('user@s.whatsapp.net', 'chat').length, 0);
});

test('training memory persists and is separate from history', () => {
  const dir = tempDir();
  const memoryFile = join(dir, 'memory.json');
  const writer = new AIMemoryStore({ filePath: memoryFile });
  const record = writer.add('owner@s.whatsapp.net', 'My favorite color is blue');
  assert.ok(record.id);

  const reader = new AIMemoryStore({ filePath: memoryFile });
  assert.equal(reader.list('owner@s.whatsapp.net')[0].content, 'My favorite color is blue');
  assert.ok(existsSync(memoryFile));
});

test('chatbot state persists per chat', () => {
  const dir = tempDir();
  const file = join(dir, 'chatbot.json');
  const writer = new ChatbotState({ filePath: file });
  writer.set('1203@g.us', true);
  writer.set('999@g.us', false);

  const reader = new ChatbotState({ filePath: file });
  assert.equal(reader.isEnabled('1203@g.us'), true);
  assert.equal(reader.isEnabled('999@g.us'), false);

  const raw = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(raw.enabledByChat, ['1203@g.us']);
});

test('rate limiter enforces window and recovers', async () => {
  const limiter = new RateLimiter({ windowMs: 200, max: 2 });
  assert.equal(limiter.allow('u1'), true);
  assert.equal(limiter.allow('u1'), true);
  assert.equal(limiter.allow('u1'), false);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(limiter.allow('u1'), true);
});

test('role hierarchy gates dangerous commands', () => {
  assert.equal(hasRole('owner', 'owner'), true);
  assert.equal(hasRole('sudo', 'sudo'), true);
  assert.equal(hasRole('owner', 'sudo'), true);
  assert.equal(hasRole('sudo', 'owner'), false);
  assert.equal(hasRole('admin', 'sudo'), false);
  assert.equal(hasRole('user', 'admin'), false);
});
