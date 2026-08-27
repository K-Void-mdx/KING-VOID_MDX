import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'node:readline/promises';
import { mkdir, rm, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { env, assertValidEnv } from './config/env.js';
import { createNovaApplication } from './core/factory.js';
import { normalizePhone, maskPhone } from './core/phone.js';
import {
  classifyDisconnect,
  nextBackoffMs,
  decideStartMode,
  canTransition,
} from './core/connection-state.js';
import { createReconnectScheduler } from './core/reconnect-scheduler.js';
import { shouldRequestPairingCode } from './core/pairing-gate.js';
import { listCommands } from './core/commands/registry.js';
import { loadWaVersion } from './core/version-cache.js';
import { bareJid, maskJid, ownerNotificationTarget } from './core/jid.js';
import { sendWithRetry } from './core/send-retry.js';
import { installLogGuard } from './core/log-guard.js';
import { createLoggerHook } from './core/session-healer.js';
import { createOnlineGate } from './core/online-gate.js';
import * as ui from './ui/banner.js';

// libsignal dumps raw session records via console.info — shield before ANY
// Baileys code can run.
installLogGuard();

assertValidEnv();

// Baileys internals stay quiet to save battery/data on Termux; lifecycle
// messaging is handled by our own human-readable logs.
const baileysLogger = pino({ level: env.nodeEnv === 'production' ? 'error' : 'warn' });
// Wrap Baileys' logger so persistent "failed to decrypt message" (Bad MAC)
// reports for a jid auto-purge that contact's stale signal session — restoring
// delivery of DMs and group @mentions that would otherwise be silently lost.
const { logger: hookedLogger } = createLoggerHook({
  logger: baileysLogger,
  authDir: env.authDir,
});

const PAIRING_TIMEOUT_MS = 30_000;
const MAX_NUMBER_PROMPTS = 3;
// 403 with a session that NEVER opened this process = server rejects stored
// creds. Fail fast (short fixed delay), then auto-wipe and re-pair in-process.
const MAX_FORBIDDEN_FRESH_BOOT = 3;
const FRESH_FORBIDDEN_DELAY_MS = 4_000;
// 403 AFTER a successful open = transient (device switch / rate limit).
// Tolerate a few consecutive failures before declaring the session dead.
const MAX_FORBIDDEN_RETRIES = 5;
// Safety cap on automatic wipe-and-repair cycles per process run.
const MAX_REPAIR_CYCLES = 2;

// ─── Single-instance process lock ─────────────────────────────────────────────
// Prevents two NOVA_VOID MDX processes from racing over the same auth directory.
// The lock file is a small JSON blob containing the owning PID and a timestamp.
// Stale locks (PID no longer alive) are safely recovered.

function lockPath(authDir) {
  return join(authDir, 'NOVA_VOID.lock');
}

async function acquireLock(authDir) {
  const path = lockPath(authDir);
  try {
    const raw = await readFile(path, 'utf8');
    const lock = JSON.parse(raw);
    // process.kill(pid, 0) throws if the PID is dead and returns undefined
    // (never a truthy value) when alive — so liveness must be read from the
    // throw, NOT from the return value.
    let alive = false;
    try { process.kill(lock.pid, 0); alive = true; } catch { alive = false; }
    if (alive) {
      console.error('[ ERROR ] Another NOVA_VOID MDX instance appears to be using this session.');
      console.log(`[ ACTION ] Stop the other process (PID ${lock.pid}) before starting a second instance.`);
      process.exit(1);
    }
    console.error(`[ ERROR ] Stale lock from PID ${lock.pid} — reclaiming.`);
    await unlink(path).catch(() => {});
  } catch { /* no lock file — proceed */ }
  await writeFile(path, JSON.stringify({ pid: process.pid, ts: Date.now() }), 'utf8');
}

async function releaseLock(authDir) {
  try { await unlink(lockPath(authDir)); } catch { /* already gone */ }
}

export async function startNovaVoid() {
  const bootStartedAt = Date.now();
  let connectAttempt = 0;
  let application;
  let activeSock;
  let shuttingDown = false;
  let pairNumber;
  let onlineSentThisProcess = false;
  const onlineGate = createOnlineGate();
  let waVersion;
  let forbiddenCount = 0;
  let everConnected = false;
  let repairCycles = 0;

  // ── Socket generation token ────────────────────────────────────────────
  // Every socket bump the generation. Handlers, pairing guards and timeouts
  // capture their own gen and no-op when it is no longer current — a stale
  // callback can never close or retry a newer socket.
  let socketGen = 0;
  // Single-flight guard: never two overlapping connect() invocations.
  let connecting = false;

  // ── Explicit startup state machine ─────────────────────────────────────
  // starting → awaiting_number → connecting → awaiting_pair/pairing → online
  // confirmed-invalid → clearing_session → awaiting_number (fresh pairing)
  // Temporary failures: connecting/reconnecting loop with bounded backoff.
  let currentState = 'starting';
  const setState = (next) => {
    if (!canTransition(currentState, next)) {
      print(ui.log.error(`ignored illegal state transition ${currentState} → ${next}`));
      return false;
    }
    currentState = next;
    return true;
  };

  // Exactly ONE reconnect timer process-wide (reschedule cancels; stale
  // generations cannot fire).
  const reconnectScheduler = createReconnectScheduler({
    timers: { set: setTimeout, clear: clearTimeout },
    onFire: () => {
      connect().catch((error) => print(ui.log.error(error?.message ?? String(error))));
    },
  });

  const print = (...lines) => console.log(...lines);
  const setMode = (label) => print(ui.log.mode(label));

  // Safe pipeline diagnostics. Message contents are never printed.
  const trace = (event, payload = {}) => {
    if (event === 'message' && env.debugMessages) {
      print(ui.log.message(maskJid(payload.senderJid), maskJid(payload.chatJid)));
    }
    if (event === 'dispatch') {
      const name = payload.name ? `.${payload.name}` : '';
      print(ui.log.command(name));
    }
    if (event === 'response') print(ui.log.response(true));
    if (event === 'command-error') {
      // Full detail stays in Termux only — never on WhatsApp.
      const stack = payload.error?.stack?.split('\n')[1]?.trim() ?? '';
      print(ui.log.error(`.${payload.command} failed: ${payload.error?.name ?? 'Error'}: ${payload.error?.message ?? 'unknown'}${stack ? ` (${stack})` : ''}`));
    }
  };

  /**
   * Interactive pairing prompt. The operator's answer is the ONLY source of
   * the pairing number — no configured default, no Enter-to-accept shortcut.
   * Empty input is rejected and re-asked up to MAX_NUMBER_PROMPTS times.
   */
  async function askPairingNumber() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      for (let attempt = 1; attempt <= MAX_NUMBER_PROMPTS; attempt++) {
        const raw = await rl.question(ui.PAIRING_PROMPT);
        const parsed = normalizePhone(raw);
        if (parsed.ok) return parsed.phone;
        print(ui.log.error(parsed.error));
      }
      throw new Error('Too many invalid number attempts.');
    } finally {
      rl.close();
    }
  }

  /**
   * Requests the real WhatsApp pairing code at the ONLY safe moment: when the
   * server emits a `qr` update. That event is proof that both the WebSocket
   * upgrade and the noise handshake succeeded — requesting earlier caused the
   * HTTP 405 upgrade failures this flow replaces. Both the handler and the
   * no-handshake guard are bound to this socket's generation: once another
   * socket exists, neither may act again.
   */
  function requestPairingWhenReady(sock, phone, gen) {
    let settled = false;
    const finish = () => {
      settled = true;
      try { sock.ev.off('connection.update', handler); } catch { /* already torn down */ }
    };
    const handler = async (update) => {
      if (settled || gen !== socketGen) return;
      if (!shouldRequestPairingCode(update, { registered: false, hasPhone: Boolean(phone) })) return;
      finish();
      clearTimeout(guard);
      try {
        setMode('Pairing');
        setState('awaiting_pair');
        print(ui.log.authWait());
        const code = await sock.requestPairingCode(phone);
        if (gen !== socketGen) return; // socket died mid-request; ignore stale result
        print(ui.pairingCodeBox(formatPairingCode(code)));
        setState('pairing');
      } catch (error) {
        print(ui.log.error(`pairing code request failed: ${error?.message ?? error}`));
      }
    };
    // No qr within the window means the connection never became usable:
    // classify and back off instead of hanging forever. A guard belonging to
    // an older generation must NEVER touch the newer socket.
    const guard = setTimeout(() => {
      if (settled || gen !== socketGen || sock !== activeSock) return;
      finish();
      print(ui.log.error(`no WhatsApp handshake within ${PAIRING_TIMEOUT_MS / 1000}s`));
      try { sock.ws?.close(); } catch { /* best effort */ }
      scheduleReconnect({ error: { output: { statusCode: undefined } } });
    }, PAIRING_TIMEOUT_MS);
    sock.ev.on('connection.update', handler);
  }

  function dropSocket(sock) {
    if (!sock) return;
    try { sock.ev.removeAllListeners(); } catch {}
    try { sock.ws?.close(); } catch {}
  }

  function scheduleReconnect(lastDisconnect, { immediate = false } = {}) {
    if (shuttingDown) return;
    application = undefined;
    dropSocket(activeSock);
    activeSock = undefined;
    reconnectScheduler.cancel(); // exactly one timer, always cancelled first

    const verdict = classifyDisconnect(lastDisconnect?.error?.output?.statusCode);

    if (verdict.action === 'stop') {
      // CONFIRMED invalid session (server says logged out): wipe and offer
      // interactive fresh pairing. connection_replaced is different — another
      // LIVE device owns the session now; auto-repair would fight it.
      if (verdict.reason === 'logged_out') {
        print(ui.log.loggedOut());
        void enterFreshPairing('Session was logged out by WhatsApp.');
        return;
      }
      if (verdict.reason === 'connection_replaced') {
        print(ui.log.replaced());
        setState('stopped');
      }
      process.exitCode = 1;
      return;
    }

    // Two-tier 403 policy:
    //  • Session never opened this process → server rejects stored creds.
    //    Fail fast (short fixed delay), then AUTO-WIPE and re-pair in-process.
    //  • Session opened before → likely transient (device switch/rate limit).
    //    Tolerate more consecutive failures before declaring death.
    if (verdict.reason === 'forbidden') {
      forbiddenCount += 1;
      const limit = everConnected ? MAX_FORBIDDEN_RETRIES : MAX_FORBIDDEN_FRESH_BOOT;
      if (forbiddenCount >= limit) {
        void enterFreshPairing(
          everConnected
            ? 'Session rejected after repeated 403 refusals.'
            : 'Stored credentials are no longer valid (403).'
        ).catch((error) =>
          print(ui.log.error(`re-pair failed: ${error?.message ?? error}`))
        );
        return;
      }
      print(ui.log.error(
        `403 received (attempt ${forbiddenCount}/${limit}). ` +
        (everConnected
          ? 'Session may be in use by another device — retrying...'
          : 'Stored credentials appear invalid — confirming...')
      ));
    } else if (verdict.action === 'restart') {
      //515 restart_required: server demands a FRESH socket promptly. Do not
      //burn backoff attempts on it; the scheduler still enforces one timer.
      print(ui.log.restart());
      setMode('Connecting');
      reconnectScheduler.schedule(500);
      return;
    } else {
      print(ui.log.retry(
        immediate ? 0 : nextBackoffMs(connectAttempt + 1),
        verdict.reason
      ));
    }

    let delay;
    if (verdict.reason === 'forbidden' && !everConnected) {
      // Fresh-boot 403s: short fixed wait instead of escalating backoff, so
      // the re-pair decision lands in seconds rather than minutes.
      delay = FRESH_FORBIDDEN_DELAY_MS;
    } else {
      connectAttempt += 1;
      delay = immediate ? 0 : nextBackoffMs(connectAttempt);
    }
    setMode('Reconnecting');
    setState(everConnected ? 'reconnecting' : 'connecting');
    reconnectScheduler.schedule(delay);
  }

  /** Clears an unregistered/broken auth dir so the next boot pairs freshly. */
  async function wipeBrokenSession() {
    try {
      await rm(env.authDir, { recursive: true, force: true });
      await mkdir(env.authDir, { recursive: true });
      print('[ AUTH ] Cleared broken session files.');
    } catch (error) {
      print(ui.log.error(`could not clear ${env.authDir}: ${error.message}`));
    }
  }

  /**
   * CONFIRMED-invalid-session path (repeated 403 / logged-out). Order matters:
   *   1. stop the old socket cleanly (scheduleReconnect already dropped it),
   *   2. remove ONLY the invalid auth files,
   *   3. reset all socket/counters state,
   *   4. ask INTERACTIVELY for the WhatsApp number to link.
   * There is deliberately NO default pairing number here — the operator's
   * answer becomes the linked bot account for this pairing flow. The process
   * lock stays held; this is still the same owner process.
   */
  async function enterFreshPairing(reason) {
    repairCycles += 1;
    if (repairCycles > MAX_REPAIR_CYCLES) {
      print(ui.log.error('Session rejected even after fresh pairing attempts — stopping.'));
      console.log('[ ACTION ] Verify the WhatsApp account, then run npm start.');
      setState('stopped');
      process.exitCode = 1;
      return;
    }

    // Guarded transition into the clearing state — never wipe on an illegal path.
    if (!setState('clearing_session')) {
      print(ui.log.error('fresh pairing requested from unexpected state — wiping skipped'));
      return;
    }
    print('');
    print(ui.freshPairingScreen());
    print(ui.log.mode(reason));
    await wipeBrokenSession();
    await acquireLock(env.authDir); // wipe removed the lock file (it lives in authDir)

    // Reset socket state completely for the new pairing attempt.
    forbiddenCount = 0;
    connectAttempt = 0;
    everConnected = false;
    socketGen += 1; // orphan every callback of every previous socket

    print(ui.authRequiredScreen());
    setMode('Awaiting authentication');
    setState('awaiting_number');
    pairNumber = await askPairingNumber();

    print(ui.verifyingScreen(maskPhone(pairNumber)));
    setMode('Connecting to WhatsApp');
    setState('connecting');
    await connect();
  }

  async function buildApplication(sock) {
    const bundle = createNovaApplication({
      botJid: sock.user?.id,
      botLid: sock.user?.lid,
      ownerJids: env.ownerJids,
      sudoJids: env.sudoJids,
      botName: env.botName,
      prefixes: [env.prefix],
      maxHistory: env.aiMaxHistory,
      storage: {
        chatbotStateFile: join(env.dataDir, 'chatbot-state.json'),
        sessionsDir: join(env.dataDir, 'history'),
        memoryFile: join(env.dataDir, 'memory.json'),
      },
      // Raw transports only — NovaApplication owns echo tracking internally,
      // so a bookkeeping failure can never turn a successful reply into a
      // "command failed" report.
      reply: (chatJid, { text }) => sock.sendMessage(chatJid, { text }),
      sendMedia: async (chatJid, media) => {
        if (media.type !== 'image' || !media.buffer) throw new Error('Unsupported media payload');
        return sock.sendMessage(chatJid, { image: media.buffer, caption: media.caption ?? '' });
      },
      trace,
      env, // Pass full env for provider registration
    });
    application = bundle.app;
  }

  async function onOpen(sock, connectedAt, gen) {
    if (gen !== socketGen || sock !== activeSock) return; // stale socket generation
    await buildApplication(sock);

    connectAttempt = 0;
    forbiddenCount = 0;
    everConnected = true;
    const seconds = ((Date.now() - connectedAt) / 1000).toFixed(1);
    setState('online');
    print(ui.connectedScreen({
      botJid: sock.user?.id,
      commands: listCommands().length,
      seconds,
    }));
    print(ui.log.online(seconds));
    setMode('Online');

    maybeSendOnlineMessage(sock);
  }

  /**
   * Sends the startup card exactly once per process. The gate transitions
   * idle → sending → sent, so concurrent opens (e.g. a 515 restart racing
   * the first send) can never produce duplicates; a fully failed cycle
   * returns to idle so a later healthy connection may retry.
   *
   * Destination: the FIRST CONFIGURED OWNER as a bare JID — never the linked
   * bot identity and never a device-suffixed variant.
   */
  function maybeSendOnlineMessage(sock) {
    if (!onlineGate.begin()) return;

    const destination = ownerNotificationTarget(env.ownerJids);
    if (!destination) {
      print(ui.log.error('no configured owner for startup message — skipping'));
      onlineGate.failure();
      return;
    }
    const body = ui.onlineMessage(env.botName, env.prefix, listCommands().length);
    sendWithRetry((attempt) => {
      print(`${ui.log.mode('Online')} startup message → ${maskJid(destination)} (attempt ${attempt})`);
      return sock.sendMessage(destination, { text: body });
    }, { attempts: 3, delayMs: 2000 })
      .then((sent) => {
        application?.trackOutbound(sent);
        onlineGate.success(); // success is the ONLY state that stops retries
        onlineSentThisProcess = true;
        print(ui.log.response(true));
      })
      .catch((error) => {
        onlineGate.failure();
        print(ui.log.error(`startup message failed after retries: ${error?.message ?? error}`));
      });
  }

  async function connect() {
    // Single-flight: never two overlapping connect() invocations (e.g. the
    // fresh-pairing flow awaiting connect while a stray timer fires).
    if (shuttingDown || connecting) return;
    connecting = true;
    try {
      const gen = ++socketGen; // this socket's generation token
      const connectedAt = Date.now();
      print(ui.log.connecting());

      const { state, saveCreds } = await useMultiFileAuthState(env.authDir);
      const sock = makeWASocket({
        // CRITICAL: rc13's baked-in WA version is rejected by WhatsApp with a
        // protocol <failure reason="405" location="atn"> before pairing can
        // start. Always connect with a current version (disk-cached, ~2 KB
        // network check at most once per week).
        version: waVersion,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, hookedLogger),
        },
        logger: hookedLogger,
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });
      activeSock = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', (update) => {
        if (gen !== socketGen || sock !== activeSock) return; // stale generation
        if (update.connection === 'open') {
          onOpen(sock, connectedAt, gen).catch((error) =>
            print(ui.log.error(error?.message ?? String(error)))
          );
        }
        if (update.connection === 'close') {
          scheduleReconnect(update.lastDisconnect);
        }
      });

      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (gen !== socketGen || type !== 'notify' || !application) return;
        for (const message of messages) {
          try {
            await application.handle(message);
          } catch (error) {
            print(ui.log.error(`message handling failed: ${error?.message ?? error}`));
          }
        }
      });

      if (!state.creds.registered && pairNumber) {
        requestPairingWhenReady(sock, pairNumber, gen);
      }
    } finally {
      connecting = false;
    }
  }

  // ---- Boot sequence ----

  print('');
  print(ui.novaBanner());
  print(ui.identityBlock());
  print(ui.titleCard());
  print('');
  setMode('Starting');
  print('');

  await Promise.all([
    mkdir(env.authDir, { recursive: true }),
    mkdir(env.dataDir, { recursive: true }),
  ]);

  await acquireLock(env.authDir);

  const resolved = await loadWaVersion({
    file: join(env.dataDir, 'wa-version.json'),
    fetchVersion: fetchLatestBaileysVersion,
  });
  waVersion = resolved.version;
  print(`[ SYSTEM ] WA protocol version : ${waVersion ? waVersion.join('.') : 'baileys default'} (${resolved.source})`);

  // Peek at existing credentials WITHOUT opening any socket.
  const peek = await useMultiFileAuthState(env.authDir);
  const bootMode = decideStartMode(Boolean(peek.state.creds.registered));

  if (bootMode.mode === 'interactive') {
    // Fresh install: the pairing number is chosen HERE, interactively.
    print(ui.authRequiredScreen());
    setMode('Awaiting authentication');
    setState('awaiting_number');
    pairNumber = await askPairingNumber();
    print(ui.verifyingScreen(maskPhone(pairNumber)));
  } else {
    // Healthy session: restore silently. Never ask for a number, never
    // request a pairing code.
    print(ui.restoreScreen());
  }

  print(ui.systemInfo({
    mode: bootMode.mode === 'interactive' ? 'Pairing' : 'Restore session',
    nodeVersion: process.version,
    platform: `${process.platform}/${process.arch}`,
    prefix: env.prefix,
  }));

  setState('connecting');
  await connect();

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    socketGen += 1;          // orphan every socket callback of this process
    reconnectScheduler.cancel(); // cancel any pending reconnect timer
    dropSocket(activeSock);
    activeSock = undefined;
    setState('stopped');
    await releaseLock(env.authDir);
    print(ui.shutdownScreen());
    print(`[ SIGNAL ] ${signal}`);
    setTimeout(() => process.exit(0), 250);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  print(`[ READY ] Operational start took ${((Date.now() - bootStartedAt) / 1000).toFixed(1)}s.`);
}

function formatPairingCode(code = '') {
  const clean = String(code).replace(/[^A-Z0-9]/gi, '');
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  startNovaVoid().catch(async (error) => {
    console.error('[ FATAL ] NOVA_VOID failed to start:', error?.message ?? error);
    await releaseLock(env.authDir).catch(() => {});
    process.exitCode = 1;
  });
}
