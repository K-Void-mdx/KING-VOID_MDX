import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdir } from 'node:fs/promises';
import { env, assertValidEnv } from './config/env.js';

assertValidEnv();
await mkdir(env.authDir, { recursive: true });
await mkdir(env.dataDir, { recursive: true });

const logger = pino({ level: env.nodeEnv === 'production' ? 'info' : 'debug' });

export async function startNovaVoid() {
  const { state, saveCreds } = await useMultiFileAuthState(env.authDir);
  const sock = makeWASocket({ auth: state, logger });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') logger.info(`${env.botName} connected`);
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode !== DisconnectReason.loggedOut) {
        logger.warn({ statusCode }, 'Connection closed; reconnecting');
        setTimeout(() => startNovaVoid().catch(error => logger.error(error)), 2000);
      } else {
        logger.error('WhatsApp session logged out; manual re-pair required');
      }
    }
  });

  return sock;
}

startNovaVoid().catch(error => {
  logger.fatal(error, 'NOVA_VOID failed to start');
  process.exitCode = 1;
});
