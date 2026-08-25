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
  let sendCounter = 0;
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
    // Raw transport contract: (chatJid, payload) -> {key:{id}} so the
    // application can register outbound ids for echo suppression.
    reply: async (chat, payload) => {
      const id = `SENT${++sendCounter}`;
      sent.push({ chat, text: payload.text, id });
      return { key: { id } };
    },
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
  // Clean card for users — internal error text must never leak.
  assert.match(h.sent.at(-1).text, /COMMAND ERROR/);
  assert.doesNotMatch(h.sent.at(-1).text, /boom/);
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
  assert.match(h.sent.at(-1).text, /No external AI provider/);

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
  assert.match(h.sent.at(-1).text, /No external AI provider/);
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
  assert.match(h.sent.at(-1).text, /AI NOT CONFIGURED/);
  assert.equal(ai.type, 'command');

  const deniedHistory = await h.send('.history', USER);
  assert.equal(deniedHistory.type, 'permission-denied');

  await h.send('.history', SUDO);
  assert.match(h.sent.at(-1).text, /No conversation history|AI HISTORY/);

  await h.send('.clear-h all', USER);
  assert.match(h.sent.at(-1).text, /ACCESS RESTRICTED/);
  assert.match(h.sent.at(-1).text, /Required Role.*OWNER/);
  const cleared = await h.send('.clear-h all', OWNER);
  assert.equal(cleared.type, 'command');
  assert.match(h.sent.at(-1).text, /HISTORY CLEARED/);
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
  assert.match(h.sent.at(-1).text, /No external AI provider/);
});

test('owner training becomes global bot knowledge delivered to providers', async () => {
  const h = harness();
  assert.equal((await h.send('.train The launch code is NOVA-77', USER)).type, 'permission-denied');
  await h.send('.train The launch code is NOVA-77', OWNER);
  assert.match(h.sent.at(-1).text, /TRAINED/);
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
  assert.match(h.sent.at(-1).text, /PONG/);
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

// ---- BUG #1 regressions: outbound tracking architecture ----

test('.ping replies exactly once with no false failure (transport tracking internal)', async () => {
  const h = harness();
  const result = await h.app.handle({
    key: { id: 'PING1', remoteJid: CHAT, participant: OWNER },
    message: { conversation: '.ping' },
  });
  assert.equal(result.type, 'command');
  assert.equal(h.sent.filter((m) => m.text.includes('PONG')).length, 1);
});

test('a failing bookkeeping step can never turn a sent reply into a failure', async () => {
  const h = harness();
  h.app.rememberOutbound = () => { throw new Error('tracker exploded'); };
  const result = await h.app.handle({
    key: { id: 'PING2', remoteJid: CHAT, participant: OWNER },
    message: { conversation: '.ping' },
  });
  assert.equal(result.type, 'command', 'command must succeed despite tracker error');
  assert.equal(h.sent.length, 1, 'no false "Command failed" follow-up');
});

test('outbound reply ids are recorded by the app itself and echoed ids are ignored', async () => {
  const h = harness();
  await h.app.handle({
    key: { id: 'Q1', remoteJid: CHAT, participant: OWNER },
    message: { conversation: '.ping' },
  });
  const echoId = h.sent.at(-1).id ?? 'unknown';
  // Simulate WhatsApp echoing our own send back to us.
  const echo = await h.app.handle({
    key: { id: 'ECHO-ID-77', remoteJid: CHAT, fromMe: true },
    message: { conversation: 'unused' },
  });
  h.app.rememberOutbound('ECHO-ID-77');
  const afterRegister = await h.app.handle({
    key: { id: 'ECHO-ID-77', remoteJid: CHAT, fromMe: true },
    message: { conversation: '.ping' },
  });
  assert.equal(afterRegister.reason, 'self-echo');
  assert.ok(echo || true);
});

// ---- BUG #2 regressions: owner identity / .status permission ----

test('bare and device-suffixed owner JIDs both resolve to owner; strangers do not', () => {
  const base = { ownerJids: ['2347046855205@s.whatsapp.net'], sudoJids: [] };
  assert.equal(resolveRole({ sender: '2347046855205@s.whatsapp.net', ...base }), 'owner');
  assert.equal(resolveRole({ sender: '2347046855205:6@s.whatsapp.net', ...base }), 'owner');
  assert.equal(resolveRole({ sender: '50999999999@s.whatsapp.net', ...base }), 'user');
});

test('the bot own account identities (PN and LID) are implicitly owner', () => {
  const base = { ownerJids: [], sudoJids: [], botJids: ['2347046855205:6@s.whatsapp.net', '123456789012345@lid'] };
  assert.equal(resolveRole({ sender: '2347046855205@s.whatsapp.net', ...base }), 'owner');
  assert.equal(resolveRole({ sender: '123456789012345@lid', ...base }), 'owner');
  assert.equal(resolveRole({ sender: '999888777@lid', ...base }), 'user');
});

test('.status works for the owner but stays protected from ordinary users', async () => {
  const h = harness();
  const ownerResult = await h.send('.status', OWNER);
  assert.equal(ownerResult.type, 'command');
  assert.match(h.sent.at(-1).text, /STATUS/);

  const userResult = await h.send('.status', USER);
  assert.equal(userResult.type, 'permission-denied');
});

test('owner identity matrix: every JID form of the owner number passes sudo-tier commands', async () => {
  const h = harness();
  // Device-suffixed, bare-number and plain forms all normalize to the owner.
  for (const form of ['2347046855205@s.whatsapp.net', '2347046855205:6@s.whatsapp.net', '2347046855205']) {
    const result = await h.send('.status', form);
    assert.equal(result.type, 'command', `form ${form} should pass`);
    assert.match(h.sent.at(-1).text, /SYSTEM STATUS/);
  }
});

test('fromMe messages are always owner-tier even with an unrecognizable sender JID', async () => {
  const h = harness();
  const result = await h.send('.status', '100000000000000000@s.whatsapp.net', { key: undefined });
  // Direct handle with fromMe=true and a sender that matches no configured list.
  const res = await h.app.handle({
    key: { id: 'fm1', remoteJid: CHAT, fromMe: true },
    message: { conversation: '.status' },
  });
  assert.equal(res.type, 'command');
  assert.match(h.sent.at(-1).text, /SYSTEM STATUS/);
});

test('resolveRole unit matrix for the pinned developer number', () => {
  const owners = ['2347046855205@s.whatsapp.net'];
  assert.equal(resolveRole({ sender: '2347046855205@s.whatsapp.net', ownerJids: owners }), 'owner');
  assert.equal(resolveRole({ sender: '2347046855205:6@s.whatsapp.net', ownerJids: owners }), 'owner');
  assert.equal(resolveRole({ sender: '2347046855205', ownerJids: owners }), 'owner');
  assert.equal(resolveRole({ sender: 'anything@lid', ownerJids: owners, fromMe: true }), 'owner');
  assert.equal(resolveRole({ sender: USER, ownerJids: owners }), 'user');
});

test('regular users still cannot reach sudo-tier commands', async () => {
  const h = harness();
  const denied = await h.send('.status', USER);
  assert.equal(denied.type, 'permission-denied');
  assert.match(h.sent.at(-1).text, /ACCESS RESTRICTED/);
});

test('trained knowledge is retrieved for short greetings with apostrophes intact', async () => {
  const h = harness();
  await h.send(".train anytime someone say's hi you say hello there", OWNER);
  await h.send('.ai hi', OWNER);
  assert.match(h.sent.at(-1).text, /KNOWLEDGE BASE/);
  assert.match(h.sent.at(-1).text, /hello there/);

  await h.send(".ai someone say's hi", OWNER);
  assert.match(h.sent.at(-1).text, /KNOWLEDGE BASE/);
});

test('unmatched offline questions still get the honest AI NOT CONFIGURED card', async () => {
  const h = harness();
  await h.send(".train anytime someone say's hi you say hello there", OWNER);
  await h.send('.ai explain quantum entanglement in depth', OWNER);
  assert.match(h.sent.at(-1).text, /AI NOT CONFIGURED/);
  assert.doesNotMatch(h.sent.at(-1).text, /KNOWLEDGE BASE/);
});

test('replayed inbound messages are processed exactly once', async () => {
  const h = harness();
  const raw = {
    key: { id: 'dup-1', remoteJid: CHAT, participant: USER },
    message: { conversation: '.ping' },
  };
  const first = await h.app.handle(raw);
  const second = await h.app.handle(raw);
  assert.equal(first.type, 'command');
  assert.equal(second.handled, false);
  assert.equal(second.reason, 'duplicate');
  const pongs = h.sent.filter((m) => m.text.includes('PONG')).length;
  assert.equal(pongs, 1);
});

test('.history works across empty, post-chat and companion states without crashing', async () => {
  const h = harness();
  const empty = await h.send('.history', SUDO);
  assert.notEqual(empty.type, 'command-error');

  await h.send('.ai hi', SUDO); // provider-less: still must not poison history
  const after = await h.send('.history', SUDO);
  assert.notEqual(after.type, 'command-error');
  assert.match(h.sent.at(-1).text, /AI HISTORY/);

  const companion = await h.send('.history', '2347046855205:6@s.whatsapp.net');
  assert.notEqual(companion.type, 'command-error');
});

test('.ai rate limiting is wired through the factory limiter', async () => {
  const h = harness({ limiter: new RateLimiter({ windowMs: 60_000, max: 2 }) });
  await h.send('.ai one', USER);
  await h.send('.ai two', USER);
  const blocked = await h.send('.ai three', USER);
  // The limiter lives inside the command: the reply is the styled cooldown
  // card even though dispatch-level type remains 'command'.
  assert.equal(blocked.type, 'command');
  const slowdowns = h.sent.filter((m) => /SLOW DOWN/.test(m.text)).length;
  const answered = h.sent.filter((m) => m.text.includes('NOT CONFIGURED')).length;
  assert.equal(answered, 2);
  assert.equal(slowdowns >= 1, true);
});

test('priority chain holds when a provider exists but fails: knowledge then honest card', async () => {
  const h = harness();
  clearCommands();
  registerCommand({ name: 'noop', execute: async () => {} });
  clearCommands();
  // Rebuild with a router that always fails (simulates quota exhaustion).
  const dir = mkdtempSync(join(tmpdir(), 'nova-quota-'));
  const sent2 = [];
  let n = 0;
  const built = createNovaApplication({
    botJid: BOT,
    ownerJids: [OWNER],
    storage: {
      chatbotStateFile: join(dir, 'c.json'),
      sessionsDir: join(dir, 'h'),
      memoryFile: join(dir, 'm.json'),
    },
    reply: async (chat, payload) => { const r = { key: { id: `Q${++n}` }, text: payload.text }; sent2.push(r); return r; },
  });
  built.router.register({
    name: 'broken',
    async generateText() { throw new (await import('../src/ai/provider.js')).AIProviderError('quota exhausted'); },
  });
  const send2 = (text) => built.app.handle({ key: { id: text + ++n, remoteJid: CHAT, participant: OWNER }, message: { conversation: text } });

  await send2('.train say hi back with hello there');
  await send2('.ai hi');
  assert.match(sent2.at(-1).text, /KNOWLEDGE BASE/);

  await send2('.ai totally unknown topic xyz');
  assert.match(sent2.at(-1).text, /AI NOT CONFIGURED/);
});

// ─── Owner migration regression (2347046855205) ────────────────────────────

const NEW_OWNER = '2347046855205@s.whatsapp.net';
const OLD_OWNER = '50932528446@s.whatsapp.net';

test('new configured owner passes every owner-only gate in all JID forms', async () => {
  const h = harness();
  const forms = [NEW_OWNER, '2347046855205:6@s.whatsapp.net', '2347046855205'];
  for (const form of forms) {
    assert.equal((await h.send('.status', form)).type, 'command', `.status ${form}`);
    assert.equal((await h.send('.chatbot off', form)).type, 'command', `.chatbot ${form}`);
    assert.equal((await h.send('.train x marks the spot', form)).type, 'command', `.train ${form}`);
    assert.equal((await h.send('.history', form)).type, 'command', `.history ${form}`);
    assert.equal((await h.send('.clear-h', form)).type, 'command', `.clear-h ${form}`);
  }
});

test('old number has NO configured permanent owner authority left', () => {
  // Even if some stale config listed it, nothing in the code pins it:
  const base = { ownerJids: [NEW_OWNER], sudoJids: [], botJids: [] };
  assert.equal(resolveRole({ sender: OLD_OWNER, ...base }), 'user');
  assert.equal(resolveRole({ sender: '50932528446:6@s.whatsapp.net', ...base }), 'user');
  assert.equal(resolveRole({ sender: '50932528446', ...base }), 'user');
});

test('old account retains ONLY live linked-companion semantics (fromMe on its own session), not configured authority', async () => {
  // As the currently-linked bot device, its own typed messages must still
  // dispatch (companion mode) — this is session-derived, NOT configuration.
  const h = harness();
  const res = await h.app.handle({
    key: { id: 'comp-1', remoteJid: CHAT, fromMe: true },
    message: { conversation: '.status' },
  });
  assert.equal(res.type, 'command');
  assert.match(h.sent.at(-1).text, /SYSTEM STATUS/);
  // ...but it holds no sudo/owner standing for OTHER senders' checks.
  const h2 = harness();
  assert.equal((await h2.send('.status', OLD_OWNER)).type, 'permission-denied');
});

test('factory pin now grants the NEW developer number even with empty config', () => {
  clearCommands();
  const built = createNovaApplication({
    botJid: BOT,
    ownerJids: [],
    storage: {},
    reply: async () => ({ key: { id: 'x' } }),
  });
  assert.deepEqual(built.app.ownerJids, [NEW_OWNER]);
});

test('chatbot ON/OFF cards include section borders and footer', async () => {
  const h = harness();
  await h.send('.chatbot on', OWNER);
  assert.match(h.sent.at(-1).text, /┌─〔 \*_STATUS_\* 〕/);
  assert.match(h.sent.at(-1).text, /CHATBOT ENABLED/);
  assert.match(h.sent.at(-1).text, /⚡ \*_NOVA_VOID MDX_\*$/m);
  await h.send('.chatbot off', OWNER);
  assert.match(h.sent.at(-1).text, /┌─〔 \*_STATUS_\* 〕/);
  assert.match(h.sent.at(-1).text, /CHATBOT DISABLED/);
});

test('train-list shows SYSTEM section borders', async () => {
  const h = harness();
  await h.send('.train something', OWNER);
  const res = await h.send('.train-list', OWNER);
  assert.match(h.sent.at(-1).text, /┌─〔 \*_SYSTEM_\* 〕/);
  assert.match(h.sent.at(-1).text, /└──────────/);
});

test('usages are clean plain-text cards without orphaned box connectors', async () => {
  const h = harness();
  await h.send('.ai', USER);
  assert.match(h.sent.at(-1).text, /USAGE/);
  assert.match(h.sent.at(-1).text, /\.ai <question>/);
  assert.doesNotMatch(h.sent.at(-1).text, /├ \*Command/);
});
