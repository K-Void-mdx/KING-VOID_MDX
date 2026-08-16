function normalizeJid(value = '') {
  return String(value).trim().toLowerCase();
}

/**
 * Determines whether an incoming WhatsApp message explicitly addresses NOVA_VOID.
 * The transport adapter supplies the normalized message context so this module
 * stays independent of a particular Baileys version.
 */
export function isChatbotTrigger(message, botJid) {
  if (!message || !botJid) return false;

  const ownJid = normalizeJid(botJid);
  const mentioned = (message.mentionedJids ?? []).some((jid) => normalizeJid(jid) === ownJid);
  const repliedToBot = normalizeJid(message.quotedParticipant) === ownJid;

  return mentioned || repliedToBot;
}

export function stripBotMention(text = '', botJid) {
  if (!text || !botJid) return String(text).trim();
  const number = String(botJid).split('@')[0].split(':')[0];
  return String(text)
    .replace(new RegExp(`@${number}\\b`, 'g'), '')
    .trim();
}
