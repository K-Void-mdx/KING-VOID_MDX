import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createNovaApplication } from '../src/core/factory.js';
import { resolveRole } from '../src/core/permissions/roles.js';
import { registerCommand, getCommand, clearCommands } from '../src/core/commands/registry.js';
import { parseCommand } from '../src/core/commands/parse.js';
import { RateLimiter } from '../src/core/rate-limit.js';

const OWNER = '2348000000001@s.whatsapp.net';
const SUDO = '2348000000003@s.whatsapp.net';
const USER = '2348000000002@s.whatsapp.net';
const CHAT = '1203@g.us';
const BOT = '2348000000009@s.whatsapp.net';

function harness({ limiter, prefixes = ['.'] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'nova-dispatch-'));
  const sent = [];
  const built = createNovaApplication({
    botJid: BOT,
    ownerJids: [OWNER],
    sudoJids: [SUDO],
    botName: 'NOVA_VOID MDX',
    prefixes,
    maxHistory: 5,
    storage: {
      chatbotStateFile: join(dir, 'chatbot.json'),
      sessionsDir: join(dir, 'history'),
      memoryFile: join(dir, 'memory.json'),
    },
    limiter,
    reply: async (chat, text) => sent.push({ chat, text }),
  });
  const send = (text, sender = USER, extra = {}) =>
    built.app.handle({
      key: { id: String(Math.random()).slice(2), remoteJid: CHAT, participant: sender },
      message: { conversation: text },
      ...extra,
    });
  return { ...built, sent, send, dir };
}

function mention(text) {
  return {
    key: { id: String(Math.random()).slice(2), remoteJid: CHAT, participant: USER },
    message: {
      extendedTextMessage: {
        text,
        contextInfo: { mentionedJid: [BOT], participant: BOT, stanzaId: 'q1' },
      },
    },
  };
}

function replyToBot(text) {
  return {
    key: { id: String(Math.random()).slice(2), remoteJid: CHAT, participant: USER },
    message: {
      extendedTextMessage: {
        text,
        contextInfo: { quotedMessage: { conversation: 'earlier bot line' }, participant: BOT, stanzaId: 'q2' },
      },
    },
  };
}

test('unknown commands are ignored without a reply', async () => {
  const h = harness();
  const result = await h.send('.definitely-not-a-command');
  assert.equal(result.handled, false);
  assert.equal(result.reason, 'unknown-command');
  assert.equal(h.sent.length, 0);
});

test('permission denied for plain users on restricted commands', async () => {
  const h = harness();
  const result = await h.send('.status', USER);
  assert.equal(result.type, 'permission-denied');
  assert.match(h.sent.at(-1).text, /permission/i);
});

test('sudo and owner may run restricted commands; owner beats device-suffix JIDs', async () => {
  assert.equal(resolveRole({ sender: OWNER.replace('@', ':7@'), ownerJids: [OWNER] }), 'owner');
  const a = harness();
  assert.equal((await a.send('.status', SUDO)).type, 'command');
  const b = harness();
  assert.equal((await b.send('.status', OWNER)).type, 'command');
});

test('command crash reports honestly instead of staying silent', async () => {
  const h = harness();
  clearCommands();
  registerCommand({ name: 'explode', execute() { throw new Error('boom'); } });
  const result = await h.send('.explode', USER);
  assert.equal(result.type, 'command-error');
  assert.match(h.sent.at(-1).text, /boom/);
  clearCommands();
});

test('custom prefixes are honoured end to end', async () => {
  const h = harness({ prefixes: ['#!'] });
  assert.deepEqual(parseCommand('#!ping'), null);
  const result = await h.send('#!ping');
  assert.equal(result.type, 'command');
  assert.match(h.sent.at(-1).text, /alive/);
});

test('registry rejects duplicates and resolves aliases', () => {
  clearCommands();
  registerCommand({ name: 'x-cmd', execute: async () => {} });
  assert.throws(() => registerCommand({ name: 'x-cmd', execute: async () => {} }), /Duplicate command/);
  registerCommand({ name: 'y-cmd', aliases: ['z-cmd'], execute: async () => {} });
  assert.throws(() => registerCommand({ name: 'w-cmd', aliases: ['z-cmd'], execute: async () => {} }), /Duplicate alias/);
  assert.equal(getCommand('Z-CMD').name, 'y-cmd');
  clearCommands();
});

test('status broadcasts never reach the dispatcher', async () => {
  const h = harness();
  const result = await h.app.handle({
    key: { id: 's1', remoteJid: 'status@broadcast' },
    message: { conversation: '.ping' },
  });
  assert.equal(result.reason, 'ignored-status');
});

test('.chatbot on/off flow: mention triggers honest fallback, silence otherwise', async () => {
  const h = harness();
  await h.send(`.chatbot on`, OWNER);
  assert.match(h.sent.at(-1).text, /ON/);

  const silent = await h.send('just chatting, no tag');
  assert.equal(silent.reason, 'no-trigger');

  const fallback = await h.app.handle(mention('@bot hello there'));
  assert.equal(fallback.type, 'chatbot');
  assert.match(h.sent.at(-1).text, /No AI provider/);

  const off = await h.send('.chatbot off', OWNER);
  assert.match(off && h.sent.at(-1).text, /OFF/);
  const afterOff = await h.app.handle(mention('@bot again'));
  assert.equal(afterOff.handled, false);

  const denied = await h.send('.chatbot on', USER);
  assert.equal(denied.type, 'permission-denied');
});

test('replying to a bot message triggers the chatbot too', async () => {
  const h = harness();
  await h.send('.chatbot on', OWNER);
  const result = await h.app.handle(replyToBot('swipe reply here'));
  assert.equal(result.type, 'chatbot');
  assert.match(h.sent.at(-1).text, /No AI provider/);
});

test('bare mentions without text stay silent and cost no rate budget', async () => {
  const h = harness({ limiter: new RateLimiter({ windowMs: 60_000, max: 1 }) });
  await h.send('.chatbot on', OWNER);
  const bare = await h.app.handle(mention('@bot'));
  assert.equal(bare.reason, 'no-trigger');
  const real = await h.app.handle(mention('@bot real question'));
  assert.equal(real.type, 'chatbot');
});

test('rate-limited mentions warn once per window instead of silence', async () => {
  const h = harness({ limiter: new RateLimiter({ windowMs: 60_000, max: 1 }) });
  await h.send('.chatbot on', OWNER);
  await h.app.handle(mention('@bot one'));
  const blocked = await h.app.handle(mention('@bot two'));
  assert.equal(blocked.type, 'rate-limited');
  assert.match(h.sent.at(-1).text, /slow down/i);
  const stillBlocked = await h.app.handle(mention('@bot three'));
  assert.equal(stillBlocked.type, 'rate-limited');
  const noticeCount = h.sent.filter((m) => /slow down/i.test(m.text)).length;
  assert.equal(noticeCount, 1);
});

test('.ai without providers answers honestly; history respects roles and scoping', async () => {
  const h = harness();
  const ai = await h.send('.ai what is love', SUDO);
  assert.match(h.sent.at(-1).text, /No AI provider is configured/);
  assert.equal(ai.type, 'command');

  const deniedHistory = await h.send('.history', USER);
  assert.equal(deniedHistory.type, 'permission-denied');

  await h.send('.history', SUDO);
  assert.match(h.sent.at(-1).text, /No AI conversation history|AI history/);

  await h.send('.clear-h all', USER);
  assert.match(h.sent.at(-1).text, /Owner only/);
  const cleared = await h.send('.clear-h all', OWNER);
  assert.equal(cleared.type, 'command');
  assert.match(h.sent.at(-1).text, /Cleared/);
});

test('offline knowledge answers trained questions without any provider', async () => {
  const h = harness();
  await h.send('.train The NOVA server password is mango42', OWNER);
  await h.send('.chatbot on', OWNER);
  const result = await h.app.handle(mention('@bot what is the nova server password'));
  assert.equal(result.type, 'chatbot');
  assert.match(h.sent.at(-1).text, /knowledge base/i);
  assert.match(h.sent.at(-1).text, /mango42/);

  await h.send('.ai repeat the nova server password', SUDO);
  assert.match(h.sent.at(-1).text, /mango42/);
});

test('unmatched offline questions honestly name the bot and its limits', async () => {
  const h = harness();
  await h.send('.chatbot on', OWNER);
  const result = await h.app.handle(mention('@bot who won the football match yesterday'));
  assert.equal(result.type, 'chatbot');
  assert.match(h.sent.at(-1).text, /NOVA_VOID MDX/);
  assert.match(h.sent.at(-1).text, /No AI provider/);
});

test('owner training becomes global bot knowledge delivered to providers', async () => {
  const h = harness();
  assert.equal((await h.send('.train The launch code is NOVA-77', USER)).type, 'permission-denied');
  await h.send('.train The launch code is NOVA-77', OWNER);
  assert.match(h.sent.at(-1).text, /Learned/);
  await h.send('.train-list', OWNER);
  assert.match(h.sent.at(-1).text, /NOVA-77/);

  let captured;
  h.router.register({
    name: 'fake',
    async generateText(request) {
      captured = request;
      return 'acknowledged';
    },
  });

  await h.send('.ai repeat the launch code please', SUDO);
  assert.ok(captured, 'provider was called');
  const systemBlob = captured.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  assert.match(systemBlob, /NOVA-77/);
  assert.equal(h.sent.at(-1).text, 'acknowledged');
});

// ---- owner-companion pipeline (live-test regression) ----

test('owner commands typed on the linked phone (fromMe) now dispatch', async () => {
  const h = harness();
  const result = await h.app.handle({
    key: { id: 'OWNERMSG1', remoteJid: `${OWNER.split('@')[0]}@s.whatsapp.net`, fromMe: true },
    message: { conversation: '.ping' },
  });
  assert.equal(result.type, 'command');
  assert.match(h.sent.at(-1).text, /is alive/i);
});

test("the bot's own sent messages are never re-dispatched as echoes", async () => {
  const h = harness();
  h.app.rememberOutbound('BOTSENT42');
  const result = await h.app.handle({
    key: { id: 'BOTSENT42', remoteJid: CHAT, fromMe: true },
    message: { conversation: '.ping' },
  });
  assert.equal(result.reason, 'self-echo');
  assert.equal(h.sent.length, 0);
});

test('ephemeral-wrapped owner command still reaches the dispatcher', async () => {
  const h = harness();
  const result = await h.app.handle({
    key: { id: 'EPH1', remoteJid: `${OWNER.split('@')[0]}@s.whatsapp.net`, fromMe: true },
    message: { ephemeralMessage: { message: { conversation: '.status' } } },
  });
  assert.equal(result.type, 'command');
});

test('protocol and reaction noise is ignored before dispatch', async () => {
  const h = harness();
  const proto = await h.app.handle({
    key: { id: 'P1', remoteJid: CHAT, participant: USER },
    message: { protocolMessage: { type: 3 } },
  });
  assert.equal(proto.reason, 'protocol');

  const reaction = await h.app.handle({
    key: { id: 'P2', remoteJid: CHAT, participant: USER },
    message: { reactionMessage: { text: '👍' } },
  });
  assert.equal(reaction.reason, 'protocol');
});
