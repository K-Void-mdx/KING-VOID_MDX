export function normalizeMessage(raw = {}) {
  const message = raw.message ?? raw;
  const key = raw.key ?? message.key ?? {};
  const context = message.extendedTextMessage?.contextInfo ?? message.contextInfo ?? {};

  const mentionedJids = [
    ...(context.mentionedJid ?? []),
    ...(context.mentionedJids ?? []),
  ].filter(Boolean);

  return {
    id: key.id ?? raw.id ?? null,
    chatJid: key.remoteJid ?? raw.chatJid ?? null,
    sender: key.participant ?? raw.sender ?? key.remoteJid ?? null,
    fromMe: Boolean(key.fromMe ?? raw.fromMe),
    text: extractText(message),
    mentionedJids,
    quotedParticipant: context.participant ?? null,
    quotedMessageId: context.stanzaId ?? null,
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
