/**
 * Unified NOVA_VOID MDX WhatsApp message style.
 * WhatsApp formatting only (no ANSI): *_bold italic_*, *bold*, `mono`.
 */

export const BOT = 'NOVA_VOID MDX';

/** ╔═══…╗ / ╚═══…╝ header block with the brand title. */
export function header(title = BOT) {
  return [
    '╔══════════════════════════════╗',
    `║ ⚡ *_${title}_* ⚡`,
    '╚══════════════════════════════╝',
  ].join('\n');
}

/** ┌─〔 *_TITLE_* 〕 section opener. */
export function section(title) {
  return `┌─〔 *_${title}_* 〕`;
}

/** ├ *Label* : `value` row. */
export function row(label, value) {
  return `├ *${label}* : \`${value}\``;
}

/** └────────── closer. */
export function sectionEnd() {
  return '└──────────';
}

/** Standard system footer. */
export function footer(text = BOT) {
  return `⚡ *_${text}_*`;
}

/** ⚠️ access-restricted card for genuinely unauthorized users. */
export function accessDenied(command, requiredRole = 'OWNER') {
  return [
    `⚠️ *_ACCESS RESTRICTED_*`,
    '',
    'You do not have permission to use:',
    `\`.${command}\``,
    '',
    row('Required Role', requiredRole.toUpperCase()),
  ].join('\n');
}

/** 🛠️ clean failure card — never leaks internals to users. */
export function commandError(command) {
  return [
    `🛠️ *_COMMAND ERROR_*`,
    '',
    `\`.${command}\` could not be completed.`,
    'Please try again in a moment.',
  ].join('\n');
}

/** 🧠 AI-not-configured card (honest offline guidance). */
export function aiNotConfigured() {
  return [
    `🧠 *_AI NOT CONFIGURED_*`,
    '',
    'No external AI provider is connected yet.',
    '',
    'You can still use the offline knowledge system:',
    '`.train <information>`',
    '',
    footer(),
  ].join('\n');
}

/** 🧠 knowledge-base answer wrapper. */
export function knowledgeAnswer(content) {
  return [`🧠 *_KNOWLEDGE BASE_*`, '', content, '', footer()].join('\n');
}

/** ⚠️ rate-limit notice for chatbot flooding. */
export function rateLimited() {
  return [`⚠️ *_SLOW DOWN_*`, '', 'You are messaging NOVA_VOID too quickly.', '', row('Status', 'COOLDOWN')].join('\n');
}
