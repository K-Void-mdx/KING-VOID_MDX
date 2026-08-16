export function getMessageText(message) {
  return message?.message?.conversation
    ?? message?.message?.extendedTextMessage?.text
    ?? message?.message?.imageMessage?.caption
    ?? message?.message?.videoMessage?.caption
    ?? '';
}

export function getContextInfo(message) {
  const content = message?.message;
  return content?.extendedTextMessage?.contextInfo
    ?? content?.imageMessage?.contextInfo
    ?? content?.videoMessage?.contextInfo
    ?? content?.documentMessage?.contextInfo
    ?? null;
}

export function isDirectMention(message, botJid) {
  if (!botJid) return false;
  const context = getContextInfo(message);
  const mentioned = context?.mentionedJid ?? [];
  return mentioned.some(jid => normalizeJid(jid) === normalizeJid(botJid));
}

export function isReplyToBot(message, botJid) {
  if (!botJid) return false;
  const context = getContextInfo(message);
  const participant = context?.participant;
  return Boolean(context?.quotedMessage && participant && normalizeJid(participant) === normalizeJid(botJid));
}

export function shouldTriggerChatbot(message, botJid) {
  return isDirectMention(message, botJid) || isReplyToBot(message, botJid);
}

function normalizeJid(jid) {
  return String(jid ?? '').replace(/:\d+(?=@)/, '').toLowerCase();
}
