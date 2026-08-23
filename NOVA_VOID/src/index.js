import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { env, assertValidEnv } from './config/env.js';
import { createNovaApplication } from './core/factory.js';

assertValidEnv();

const logger = pino({ level: env.nodeEnv === 'production' ? 'info' : 'debug' });
let reconnectTimer;

export async function startNovaVoid() {
  await Promise.all([
    mkdir(env.authDir, { recursive: true }),
    mkdir(env.dataDir, { recursive: true }),
  ]);
  const { state, saveCreds } = await useMultiFileAuthState(env.authDir);
  // NOTE: no fetchLatestBaileysVersion() call — saves a network round-trip per boot.
  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  let application;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr && !state.creds.registered) {
      logger.warn('Not paired yet. Set PAIR_PHONE in .env to receive a pairing code.');
    }

    if (connection === 'open') {
      const botJid = sock.user?.id;
      application = createNovaApplication({
        botJid,
        ownerJids: env.ownerJids,
        sudoJids: env.sudoJids,
        storage: {
          chatbotStateFile: join(env.dataDir, 'chatbot-state.json'),
          sessionsDir: join(env.dataDir, 'history'),
          memoryFile: join(env.dataDir, 'memory.json'),
        },
        reply: (chatJid, text) => sock.sendMessage(chatJid, { text }),
        sendMedia: (chatJid, media) => {
          if (media.type !== 'image' || !media.buffer) throw new Error('Unsupported media payload');
          return sock.sendMessage(chatJid, { image: media.buffer, caption: media.caption ?? '' });
        },
      });
      logger.info({ botJid }, `${env.botName} connected`);
    }

    if (connection === 'close') {
      application = undefined;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        logger.error('WhatsApp session logged out; delete data/auth and re-pair.');
        return;
      }
      if (!reconnectTimer) {
        logger.warn({ statusCode }, 'Connection closed; scheduling reconnect');
        reconnectTimer = setTimeout(() => {
          reconnectTimer = undefined;
          startNovaVoid().catch((error) => logger.error(error, 'Reconnect failed'));
        }, 3000);
      }
    }
  });

  // Pairing-code login for fresh installs (no QR scanner needed on Termux).
  if (!state.creds.registered) {
    if (!env.pairingPhone) {
      logger.warn('No PAIR_PHONE configured. Add PAIR_PHONE=<your number, country code first> to .env');
    } else {
      try {
        const code = await sock.requestPairingCode(env.pairingPhone);
        logger.warn(`PAIRING CODE for ${env.pairingPhone}: ${formatPairingCode(code)}`);
        console.log(`\n  NOVA_VOID MDX pairing code: ${formatPairingCode(code)}\n  Enter it on WhatsApp: Linked devices -> Link with phone number.\n`);
      } catch (error) {
        logger.error({ error }, 'Failed to request pairing code');
      }
    }
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !application) return;
    for (const message of messages) {
      try {
        await application.app.handle(message);
      } catch (error) {
        logger.error({ error, messageId: message.key?.id }, 'Message handling failed');
      }
    }
  });

  return sock;
}

function formatPairingCode(code = '') {
  const clean = String(code).replace(/[^A-Z0-9]/gi, '');
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

startNovaVoid().catch((error) => {
  logger.fatal(error, 'NOVA_VOID failed to start');
  process.exitCode = 1;
});
