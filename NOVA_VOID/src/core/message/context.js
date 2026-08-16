export function normalizeMessage(raw = {}) {
  const message = raw.message ?? raw;
  const sender = raw.sender ?? message.sender ?? message.participant ?? '';
  const chatJid = raw.chatJid ?? message.chatJid ?? message.key?.remoteJid ?? '';
  const botJid = raw.botJid ?? '';

  return {
    id: raw.id ?? message.key?.id ?? '',
    sender: String(sender),
    chatJid: String(chatJid),
    botJid: String(botJid),
    text: String(raw.text ?? message.text ?? message.body ?? ''),
    mentionedJids: [...(raw.mentionedJids ?? message.mentionedJids ?? [])],
    quotedParticipant: String(raw.quotedParticipant ?? message.quotedParticipant ?? ''),
    isGroup: String(chatJid).endsWith('@g.us'),
    timestamp: raw.timestamp ?? Date.now(),
    raw: message,
  };
}
