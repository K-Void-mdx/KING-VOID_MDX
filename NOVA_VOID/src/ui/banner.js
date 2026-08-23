const W = 40;

function rule(char = '═') {
  return char.repeat(W);
}

export function novaBanner() {
  return [
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
  ].join('\n');
}

export function identityBlock() {
  return [
    '',
    '              NOVA',
    '        VOID  -  MDX',
    '',
  ].join('\n');
}

export function titleCard(version = 'v3.0') {
  return [
    rule(),
    `        NOVA_VOID MDX ${version}`.padEnd(W),
    '   WhatsApp Automation & AI System',
    rule(),
  ].join('\n');
}

export function systemInfo({ mode, nodeVersion, platform, prefix }) {
  return [
    `[ SYSTEM ] Bot        : NOVA_VOID MDX`,
    `[ SYSTEM ] Mode       : ${mode}`,
    `[ SYSTEM ] Node       : ${nodeVersion}`,
    `[ SYSTEM ] Platform   : ${platform}`,
    `[ SYSTEM ] Prefix     : ${prefix}`,
  ].join('\n');
}

export function authRequiredScreen(defaultPhone) {
  const hint = defaultPhone ? ` [${defaultPhone}]` : '';
  return [
    '',
    '[ AUTHENTICATION REQUIRED ]',
    '',
    'Enter your WhatsApp number.',
    'Include country code without + or spaces.',
    'Example: 2348012345678',
    hint ? `Press Enter to use the configured number${hint}.` : '',
    '',
  ].filter(Boolean).join('\n');
}

export function verifyingScreen(masked) {
  return ['', '[ VERIFYING NUMBER ]', `Number: ${masked}`, '', '[ CONNECTING TO WHATSAPP ]', 'Please wait...', ''].join('\n');
}

export function restoreScreen() {
  return ['', '[ AUTHENTICATED SESSION FOUND ]', 'Restoring NOVA_VOID MDX...', '', '[ CONNECTING ]', ''].join('\n');
}

export function pairingCodeBox(code) {
  return [
    '',
    '[ PAIRING CODE READY ]',
    '',
    '┌─────────────────────────────┐',
    `│        ${code}            │`,
    '└─────────────────────────────┘',
    '',
    'Open WhatsApp:',
    '  Settings',
    '  → Linked devices',
    '  → Link a device',
    '  → Link with phone number instead',
    '',
    'Enter the code above.',
    '',
  ].join('\n');
}

export function connectedScreen({ botJid, commands, seconds }) {
  return [
    '',
    '╔══════════════════════════════════════╗',
    '║       CONNECTED SUCCESSFULLY         ║',
    '╚══════════════════════════════════════╝',
    `✓ WhatsApp connection established`,
    `✓ Authentication saved`,
    `✓ Commands loaded (${commands})`,
    `✓ Chatbot system ready`,
    `✓ NOVA_VOID MDX is online`,
    '',
    `Bot JID : ${botJid ?? 'unknown'}`,
    `Startup : ${seconds}s`,
    '',
  ].join('\n');
}

export function onlineMessage(botName = 'NOVA_VOID MDX') {
  return [
    '╔══════════════════════════════╗',
    `║      🌌 ${botName}       ║`,
    '║        IS NOW ONLINE         ║',
    '╚══════════════════════════════╝',
    '',
    'Hello, Owner! 👋',
    '',
    `${botName} has successfully connected`,
    'and is now active.',
    '',
    '🤖 Status: ONLINE',
    '⚡ Core: READY',
    '🧠 AI System: STANDBY',
    '💬 Chatbot: AVAILABLE',
    '🛡️ Security: ACTIVE',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    'Quick Start:',
    '',
    '• .ping — Check bot response',
    '• .menu — View available commands',
    '• .status — View system status',
    '• .chatbot on — Enable chatbot',
    '• .chatbot off — Disable chatbot',
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '✨ NOVA_VOID MDX is ready.',
  ].join('\n');
}

export function shutdownScreen() {
  return [
    '',
    '[ SHUTTING DOWN ]',
    'Saving state...',
    'Closing connection...',
    'NOVA_VOID MDX stopped safely.',
    '',
  ].join('\n');
}

export const log = {
  connecting: () => '[ CONNECTING ] Establishing WhatsApp connection...',
  authWait: () => '[ AUTH ] Waiting for pairing authorization...',
  online: (seconds) => `[ ONLINE ] NOVA_VOID MDX is connected.${seconds != null ? ` Connected in ${seconds}s.` : ''}`,
  retry: (seconds, reason) => `[ RETRY ] Connection interrupted (${reason}). Retrying in ${Math.round(seconds / 1000)} second(s)...`,
  restart: () => '[ RETRY ] Server requested a fresh connection. Reconnecting now...',
  loggedOut: () => '[ AUTH ] Session was logged out. Delete data/auth, then run npm start again to re-pair.',
  forbidden: () => '[ ERROR ] WhatsApp refused this device (403). Wait a few minutes and try again.',
  replaced: () => '[ WARN ] Connection replaced by another session of this account.',
  error: (message) => `[ ERROR ] ${message}`,
};
