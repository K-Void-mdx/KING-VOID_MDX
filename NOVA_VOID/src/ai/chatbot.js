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

/**
 * Removes bot-addressment artifacts from the prompt text.
 * WhatsApp renders mentions as "@DisplayName" (not "@number"), so when the
 * message was a direct mention we also drop leading @tokens; plain numbers
 * are stripped regardless.
 */
export function stripBotMention(text = '', botJid, { mentioned = false } = {}) {
  let out = String(text ?? '').trim();
  if (!out) return '';
  if (botJid) {
    const number = String(botJid).split('@')[0].split(':')[0];
    if (number) out = out.replace(new RegExp(`@${number}\\b`, 'g'), '');
  }
  if (mentioned) out = out.replace(/^(?:@\S+\s*)+/, '');
  return out.trim();
}
