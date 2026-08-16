export function normalizeMessage(raw = {}, { botJid = '' } = {}) {
  const message = raw.message ?? raw;
  const key = raw.key ?? message.key ?? {};
  const context = message.extendedTextMessage?.contextInfo ?? message.contextInfo ?? {};

  const mentionedJids = [
    ...(context.mentionedJid ?? []),
    ...(context.mentionedJids ?? []),
    ...(raw.mentionedJids ?? []),
  ].filter(Boolean);

  return {
    id: key.id ?? raw.id ?? null,
    chatJid: key.remoteJid ?? raw.chatJid ?? null,
    senderJid: key.participant ?? raw.senderJid ?? raw.sender ?? key.remoteJid ?? null,
    fromMe: Boolean(key.fromMe ?? raw.fromMe),
    text: extractText(message),
    mentionedJids,
    quotedParticipant: context.participant ?? raw.quotedParticipant ?? null,
    quotedMessageId: context.stanzaId ?? raw.quotedMessageId ?? null,
    isGroup: String(key.remoteJid ?? raw.chatJid ?? '').endsWith('@g.us'),
    isFromBot: Boolean(key.fromMe ?? raw.fromMe),
    botJid,
    raw,
  };
}

function extractText(message) {
  if (typeof message === 'string') return message;
  return (
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.imageMessage?.caption ??
    message?.videoMessage?.caption ??
    message?.documentWithCaptionMessage?.message?.documentMessage?.caption ??
    ''
  );
}
