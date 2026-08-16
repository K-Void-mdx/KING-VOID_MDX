import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdir } from 'node:fs/promises';
import { env, assertValidEnv } from './config/env.js';
import { createNovaApplication } from './core/factory.js';

assertValidEnv();
await mkdir(env.authDir, { recursive: true });
await mkdir(env.dataDir, { recursive: true });

const logger = pino({ level: env.nodeEnv === 'production' ? 'info' : 'debug' });
let reconnectTimer;

export async function startNovaVoid() {
  const { state, saveCreds } = await useMultiFileAuthState(env.authDir);
  const sock = makeWASocket({ auth: state, logger });
  let application;

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      const botJid = sock.user?.id;
      const ownerJids = env.ownerJid ? [env.ownerJid] : [];
      application = createNovaApplication({
        botJid,
        ownerJids,
        reply: (chatJid, text) => sock.sendMessage(chatJid, { text }),
        sendMedia: (chatJid, media) => {
          if (media.type !== 'image' || !media.buffer) throw new Error('Unsupported media payload');
          return sock.sendMessage(chatJid, { image: media.buffer, caption: media.caption ?? '' });
        },
      });
      logger.info({ botJid }, `${env.botName} connected`);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut && !reconnectTimer) {
        logger.warn({ statusCode }, 'Connection closed; scheduling reconnect');
        reconnectTimer = setTimeout(() => {
          reconnectTimer = undefined;
          startNovaVoid().catch((error) => logger.error(error, 'Reconnect failed'));
        }, 2000);
      } else if (statusCode === DisconnectReason.loggedOut) {
        logger.error('WhatsApp session logged out; manual re-pair required');
      }
    }
  });

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

startNovaVoid().catch((error) => {
  logger.fatal(error, 'NOVA_VOID failed to start');
  process.exitCode = 1;
});
