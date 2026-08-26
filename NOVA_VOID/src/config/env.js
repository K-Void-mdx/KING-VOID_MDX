import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root = NOVA_VOID/, independent of where the bot is started from.
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Loads KEY=VALUE pairs from .env without overriding real environment variables. */
function loadDotEnv(filePath) {
  try {
    if (!existsSync(filePath)) return;
    for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch { /* a broken .env must not stop startup */ }
}

loadDotEnv(process.env.ENV_FILE || join(PROJECT_ROOT, '.env'));

const value = (input, fallback = '') => String(input ?? fallback).trim();

/** Comma-separated JID list support: "OWNER_JIDS=a@x,b@x" */
function jidList(primary, legacySingle) {
  const items = String(primary ?? '').split(',').map((item) => value(item)).filter(Boolean);
  const single = value(legacySingle);
  if (single && !items.includes(single)) items.push(single);
  return Object.freeze(items);
}

function resolvePath(input, fallback) {
  const raw = value(input, fallback);
  return resolve(PROJECT_ROOT, raw);
}

// Permanent developer/owner of NOVA_VOID MDX. Always granted the highest
// role regardless of what else is configured in OWNER_JIDS.
// NOTE: this is the CONFIGURED permanent owner. It is architecturally
// separate from the linked WhatsApp bot account: the account chosen during
// interactive pairing gets NO configured authority from this pin — owner
// rights come ONLY from OWNER_JIDS / DEVELOPER_NUMBER matching the sender.
const DEVELOPER_NUMBER = '2347046855205';
const DEVELOPER_JID = `${DEVELOPER_NUMBER}@s.whatsapp.net`;
export { DEVELOPER_JID };

function withDeveloper(jids) {
  return Object.freeze(jids.includes(DEVELOPER_JID) ? jids : [...jids, DEVELOPER_JID]);
}

export const env = Object.freeze({
  nodeEnv: value(process.env.NODE_ENV, 'development'),
  botName: value(process.env.BOT_NAME, 'NOVA_VOID MDX'),
  prefix: value(process.env.PREFIX, '.'),
  ownerJids: withDeveloper(jidList(process.env.OWNER_JIDS, process.env.OWNER_JID)),
  developerNumber: DEVELOPER_NUMBER,
  sudoJids: jidList(process.env.SUDO_JIDS),
  authDir: resolvePath(process.env.AUTH_DIR, './data/auth'),
  dataDir: resolvePath(process.env.DATA_DIR, './data'),
  aiMaxHistory: Number(value(process.env.AI_MAX_HISTORY, '40')) || 40,
  debugMessages: /^(1|true|yes)$/i.test(value(process.env.DEBUG_MESSAGES, '')),
  // AI provider keys — never commit real values
  geminiApiKey: value(process.env.GEMINI_API_KEY),
  groqApiKey: value(process.env.GROQ_API_KEY),
  openCodeApiKey: value(process.env.OPENCODE_API_KEY),
  openRouterApiKey: value(process.env.OPENROUTER_API_KEY),
});

export function assertValidEnv() {
  if (!env.botName) throw new Error('BOT_NAME cannot be empty');
  if (!env.prefix) throw new Error('PREFIX cannot be empty');
}
