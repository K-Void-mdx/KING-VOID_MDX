import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'node:readline/promises';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { env, assertValidEnv } from './config/env.js';
import { createNovaApplication } from './core/factory.js';
import { normalizePhone, maskPhone } from './core/phone.js';
import {
  classifyDisconnect,
  nextBackoffMs,
  decideStartMode,
} from './core/connection-state.js';
import { listCommands } from './core/commands/registry.js';
import { loadWaVersion } from './core/version-cache.js';
import { bareJid, maskJid } from './core/jid.js';
import { sendWithRetry } from './core/send-retry.js';
import { installLogGuard } from './core/log-guard.js';
import { createOnlineGate } from './core/online-gate.js';
import * as ui from './ui/banner.js';

// libsignal dumps raw session records via console.info — shield before ANY
// Baileys code can run.
installLogGuard();

assertValidEnv();

// Baileys internals stay quiet to save battery/data on Termux; lifecycle
// messaging is handled by our own human-readable logs.
const baileysLogger = pino({ level: env.nodeEnv === 'production' ? 'error' : 'warn' });

const PAIRING_TIMEOUT_MS = 30_000;
const MAX_NUMBER_PROMPTS = 3;

export async function startNovaVoid() {
  const bootStartedAt = Date.now();
  let connectAttempt = 0;
  let reconnectTimer;
  let application;
  let activeSock;
  let shuttingDown = false;
  let pairNumber;
  let onlineSentThisProcess = false;
  const onlineGate = createOnlineGate();
  let waVersion;

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
      print(ui.log.error(`.${payload.command} failed: ${payload.error?.message ?? 'unknown'}`));
    }
  };

  async function askPairingNumber() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      for (let attempt = 1; attempt <= MAX_NUMBER_PROMPTS; attempt++) {
        const raw = await rl.question(
          `Number${env.pairingPhone ? ` [${env.pairingPhone}]` : ''}: `
        );
        const parsed = normalizePhone(raw, env.pairingPhone);
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
   * HTTP 405 upgrade failures this flow replaces.
   */
  function requestPairingWhenReady(sock, phone) {
    let settled = false;
    const handler = async (update) => {
      if (!update.qr || settled) return;
      settled = true;
      sock.ev.off('connection.update', handler);
      clearTimeout(guard);
      try {
        setMode('Pairing');
        print(ui.log.authWait());
        const code = await sock.requestPairingCode(phone);
        print(ui.pairingCodeBox(formatPairingCode(code)));
      } catch (error) {
        print(ui.log.error(`pairing code request failed: ${error?.message ?? error}`));
      }
    };
    // No qr within the window means the connection never became usable:
    // classify and back off instead of hanging forever.
    const guard = setTimeout(() => {
      if (settled) return;
      settled = true;
      sock.ev.off('connection.update', handler);
      print(ui.log.error(`no WhatsApp handshake within ${PAIRING_TIMEOUT_MS / 1000}s`));
      try { sock.ws?.close(); } catch {}
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
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }

    const verdict = classifyDisconnect(lastDisconnect?.error?.output?.statusCode);

    if (verdict.action === 'stop') {
      if (verdict.reason === 'logged_out') {
        print(ui.log.loggedOut());
        void wipeBrokenSession();
      } else if (verdict.reason === 'forbidden') {
        print(ui.log.forbidden());
      } else {
        print(ui.log.replaced());
      }
      process.exitCode = 1;
      return;
    }

    if (verdict.action === 'restart') {
      // 515 restart_required: server demands a FRESH socket promptly. Do not
      // burn backoff attempts on it; single-flight timer still applies.
      print(ui.log.restart());
      setMode('Connecting');
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = undefined;
          connect().catch((error) => print(ui.log.error(error?.message ?? String(error))));
        }, 500);
      }
      return;
    }

    connectAttempt += 1;
    const delay = immediate ? 0 : nextBackoffMs(connectAttempt);
    print(ui.log.retry(delay, verdict.reason));
    setMode('Reconnecting');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      connect().catch((error) => print(ui.log.error(error?.message ?? String(error))));
    }, delay);
  }

  /** Clears an unregistered/broken auth dir so the next boot pairs freshly. */
  async function wipeBrokenSession() {
    try {
      await rm(env.authDir, { recursive: true, force: true });
      await mkdir(env.authDir, { recursive: true });
      print('[ AUTH ] Cleared broken session files. Restart npm start to pair again.');
    } catch (error) {
      print(ui.log.error(`could not clear ${env.authDir}: ${error.message}`));
    }
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
    });
    application = bundle.app;
  }

  async function onOpen(sock, connectedAt) {
    await buildApplication(sock);

    connectAttempt = 0;
    const seconds = ((Date.now() - connectedAt) / 1000).toFixed(1);
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
   */
  function maybeSendOnlineMessage(sock) {
    if (!onlineGate.begin()) return;

    const destination = bareJid(env.ownerJids[0] ?? '') || bareJid(sock.user?.id ?? '');
    if (!destination) {
      print(ui.log.error('no valid destination for startup message'));
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
        onlineGate.success();
        onlineSentThisProcess = true;
        print(ui.log.response(true));
      })
      .catch((error) => {
        onlineGate.failure();
        print(ui.log.error(`startup message failed after retries: ${error?.message ?? error}`));
      });
  }

  async function connect() {
    if (shuttingDown) return;
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
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      logger: baileysLogger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    activeSock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      if (update.connection === 'open') {
        onOpen(sock, connectedAt).catch((error) =>
          print(ui.log.error(error?.message ?? String(error)))
        );
      }
      if (update.connection === 'close') {
        scheduleReconnect(update.lastDisconnect);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' || !application) return;
      for (const message of messages) {
        try {
          await application.handle(message);
        } catch (error) {
          print(ui.log.error(`message handling failed: ${error?.message ?? error}`));
        }
      }
    });

    if (!state.creds.registered && pairNumber) {
      requestPairingWhenReady(sock, pairNumber);
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
    setMode('Awaiting authentication');
    print(ui.authRequiredScreen(env.pairingPhone || undefined));
    pairNumber = await askPairingNumber();
    print(ui.verifyingScreen(maskPhone(pairNumber)));
  } else {
    print(ui.restoreScreen());
  }

  print(ui.systemInfo({
    mode: bootMode.mode === 'interactive' ? 'Pairing' : 'Restore session',
    nodeVersion: process.version,
    platform: `${process.platform}/${process.arch}`,
    prefix: env.prefix,
  }));

  await connect();

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    dropSocket(activeSock);
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
  startNovaVoid().catch((error) => {
    console.error('[ FATAL ] NOVA_VOID failed to start:', error?.message ?? error);
    process.exitCode = 1;
  });
}
