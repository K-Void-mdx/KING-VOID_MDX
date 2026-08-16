import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCommand } from '../src/core/commands/parse.js';
import { normalizeMessage } from '../src/core/message/normalize.js';
import { isChatbotTrigger } from '../src/ai/chatbot.js';
import { AISessionStore } from '../src/ai/session-store.js';

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
