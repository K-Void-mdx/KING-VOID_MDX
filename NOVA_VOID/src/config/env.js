const value = (input, fallback = '') => String(input ?? fallback).trim();

export const env = Object.freeze({
  nodeEnv: value(process.env.NODE_ENV, 'development'),
  botName: value(process.env.BOT_NAME, 'NOVA_VOID'),
  prefix: value(process.env.PREFIX, '.'),
  ownerJid: value(process.env.OWNER_JID),
  authDir: value(process.env.AUTH_DIR, './data/auth'),
  dataDir: value(process.env.DATA_DIR, './data')
});

export function assertValidEnv() {
  if (!env.botName) throw new Error('BOT_NAME cannot be empty');
  if (!env.prefix) throw new Error('PREFIX cannot be empty');
}
