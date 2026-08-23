// ANSI helpers — zero dependencies.
const C = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[96m',
  blue: '\x1b[94m',
  magenta: '\x1b[95m',
  white: '\x1b[97m',
  green: '\x1b[92m',
  yellow: '\x1b[93m',
  red: '\x1b[91m',
  grey: '\x1b[90m',
};

export function paint(color, text) {
  return `${C[color] ?? ''}${text}${C.reset}`;
}

const W = 40;

function rule(char = '═') {
  return char.repeat(W);
}

export function novaBanner() {
  const art = [
    '███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ ',
    '████╗  ██║██╔═══██╗██║   ██║██╔══██╗',
    '██╔██╗ ██║██║   ██║██║   ██║███████║',
    '██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║',
    '██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║',
    '╚═╝  ╚═══╝ ╚═════╝   ╚════╝  ╚═╝  ╚═╝',
    '',
    '██╗   ██╗ ██████╗ ██╗██████╗ ',
    '██║   ██║██╔═══██╗██║██╔══██╗',
    '██║   ██║██║   ██║██║██║  ██║',
    '╚██╗ ██╔╝██║   ██║██║██║  ██║',
    ' ╚████╔╝ ╚██████╔╝██║██████╔╝',
    '  ╚═══╝   ╚═════╝ ╚═╝╚═════╝ ',
    '',
    '      ███╗   ███╗██████╗ ██╗  ██╗',
    '      ████╗ ████║██╔══██╗╚██╗██╔╝',
    '      ██╔████╔██║██║  ██║ ╚███╔╝',
    '      ██║╚██╔╝██║██║  ██║ ██╔██╗',
    '      ██║ ╚═╝ ██║██████╔╝██╔╝ ██╗',
    '      ╚═╝     ╚═╝╚═════╝ ╚═╝  ╚═╝',
  ];
  // Neon cyber style: art in bright cyan, subtle blue glow line beneath.
  return art.map((line) => (line.trim() ? paint('cyan', line) : line)).join('\n');
}

export function identityBlock() {
  return [
    '',
    paint('magenta', '              NOVA'),
    paint('magenta', '        VOID  -  MDX'),
    '',
  ].join('\n');
}

export function titleCard(version = 'v3.0') {
  return [
    paint('blue', rule()),
    paint('bright', `        NOVA_VOID MDX ${version}`.padEnd(W)),
    paint('white', '   WhatsApp Automation & AI System'),
    paint('blue', rule()),
  ].join('\n');
}

export function systemInfo({ mode, nodeVersion, platform, prefix }) {
  const label = (name, value) => `${paint('bright', `[ SYSTEM ]`)} ${paint('white', name.padEnd(9))}: ${paint('grey', value)}`;
  return [
    label('Bot', 'NOVA_VOID MDX'),
    label('Mode', mode),
    label('Node', nodeVersion),
    label('Platform', platform),
    label('Prefix', prefix),
  ].join('\n');
}

export function versionLine(version, source) {
  return `${paint('bright', '[ SYSTEM ]')} ${paint('white', 'WA proto'.padEnd(9))}: ${paint('grey', `${version ?? 'baileys default'} (${source})`)}`;
}

export function authRequiredScreen(defaultPhone) {
  const hint = defaultPhone ? ` [${defaultPhone}]` : '';
  return [
    '',
    paint('yellow', '[ AUTHENTICATION REQUIRED ]'),
    '',
    paint('white', 'Enter your WhatsApp number.'),
    paint('grey', 'Include country code without + or spaces.'),
    paint('grey', 'Example: 2348012345678'),
    hint ? paint('grey', `Press Enter to use the configured number${hint}.`) : '',
    '',
  ].filter(Boolean).join('\n');
}

export function verifyingScreen(masked) {
  return [
    '',
    paint('yellow', '[ VERIFYING NUMBER ]'),
    paint('white', `Number: ${masked}`),
    '',
    paint('cyan', '[ CONNECTING TO WHATSAPP ]'),
    paint('grey', 'Please wait...'),
    '',
  ].join('\n');
}

export function restoreScreen() {
  return [
    '',
    paint('green', '[ AUTHENTICATED SESSION FOUND ]'),
    paint('grey', 'Restoring NOVA_VOID MDX...'),
    '',
    paint('cyan', '[ CONNECTING ]'),
    '',
  ].join('\n');
}

export function pairingCodeBox(code) {
  return [
    '',
    paint('green', '[ PAIRING CODE READY ]'),
    '',
    paint('cyan', '┌─────────────────────────────┐'),
    paint('bright', `│        ${code}            │`),
    paint('cyan', '└─────────────────────────────┘'),
    '',
    paint('white', 'Open WhatsApp:'),
    paint('grey', '  Settings'),
    paint('grey', '  → Linked devices'),
    paint('grey', '  → Link a device'),
    paint('grey', '  → Link with phone number instead'),
    '',
    paint('yellow', 'Enter the code above.'),
    '',
  ].join('\n');
}

export function connectedScreen({ botJid, commands, seconds }) {
  const check = (text) => paint('green', `✓ ${text}`);
  return [
    '',
    paint('green', '╔══════════════════════════════════════╗'),
    paint('green', '║       CONNECTED SUCCESSFULLY         ║'),
    paint('green', '╚══════════════════════════════════════╝'),
    check('WhatsApp connection established'),
    check('Authentication saved'),
    check(`Commands loaded (${commands})`),
    check('Chatbot system ready'),
    check('NOVA_VOID MDX is online'),
    '',
    `${paint('bright', 'Bot JID ')}: ${botJid ?? 'unknown'}`,
    `${paint('bright', 'Startup ')}: ${seconds}s`,
    '',
  ].join('\n');
}

export function onlineMessage(botName = 'NOVA_VOID MDX', prefix = '.', commands = 0) {
  return [
    '╔══════════════════════════════╗',
    `║      ⚡ ${botName} ⚡     ║`,
    '╚══════════════════════════════╝',
    '',
    '🟢 SYSTEM ONLINE',
    '',
    `Hello! ${botName} has successfully connected and is now active.`,
    '',
    '┌─〔 SYSTEM STATUS 〕',
    `├ Bot      : ${botName}`,
    '├ Status   : ONLINE',
    `├ Prefix   : ${prefix}`,
    `├ Commands : ${commands}`,
    '├ Mode     : Operational',
    '└──────────',
    '',
    '💬 Try:',
    `${prefix}ping`,
    `${prefix}menu`,
    `${prefix}status`,
    '',
    '⚡ Ready for commands.',
  ].join('\n');
}

export function shutdownScreen() {
  return [
    '',
    paint('yellow', '[ SHUTTING DOWN ]'),
    paint('grey', 'Saving state...'),
    paint('grey', 'Closing connection...'),
    paint('green', 'NOVA_VOID MDX stopped safely.'),
    '',
  ].join('\n');
}

export const log = {
  connecting: () => `${paint('cyan', '[ CONNECTING ]')} Establishing WhatsApp connection...`,
  authWait: () => `${paint('yellow', '[ AUTH ]')} Waiting for pairing authorization...`,
  online: (seconds) => `${paint('green', '[ ONLINE ]')} NOVA_VOID MDX is connected.${seconds != null ? ` Connected in ${seconds}s.` : ''}`,
  message: (from, chat) => `${paint('blue', '[ MESSAGE ]')} from ${from} in ${chat}`,
  command: (name) => `${paint('cyan', '[ COMMAND ]')} ${name}`,
  response: (ok) => ok
    ? `${paint('green', '[ RESPONSE ]')} Sent successfully`
    : `${paint('red', '[ RESPONSE ]')} Failed`,
  retry: (seconds, reason) => `${paint('yellow', '[ RETRY ]')} Connection interrupted (${reason}). Retrying in ${Math.round(seconds / 1000)} second(s)...`,
  restart: () => `${paint('yellow', '[ RETRY ]')} Server requested a fresh connection. Reconnecting now...`,
  loggedOut: () => `${paint('red', '[ AUTH ]')} Session was logged out. Delete data/auth, then run npm start again to re-pair.`,
  forbidden: () => `${paint('red', '[ ERROR ]')} WhatsApp refused this device (403). Wait a few minutes and try again.`,
  replaced: () => `${paint('yellow', '[ WARN ]')} Connection replaced by another session of this account.`,
  error: (message) => `${paint('red', '[ ERROR ]')} ${message}`,
  mode: (mode) => `${paint('blue', '[ MODE ]')} ${mode}`,
};
