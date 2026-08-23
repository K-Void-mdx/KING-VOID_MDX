const WRAPPER_KEYS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage',
];

/** Peels WhatsApp wrappers (ephemeral, view-once, document-with-caption). */
export function unwrapMessage(message) {
  let current = message;
  let wrapped = false;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const wrapper = WRAPPER_KEYS.find((key) => current[key]?.message);
    if (!wrapper) break;
    current = current[wrapper].message;
    wrapped = true;
  }
  return { message: current, wrapped };
}

export function normalizeMessage(raw = {}, { botJid = '' } = {}) {
  const envelope = raw.message ?? raw;
  const key = raw.key ?? envelope.key ?? {};
  const { message } = unwrapMessage(envelope);
  const context = message?.extendedTextMessage?.contextInfo ?? message?.contextInfo ?? {};

  const mentionedJids = [
    ...(context.mentionedJid ?? []),
    ...(context.mentionedJids ?? []),
    ...(raw.mentionedJids ?? []),
  ].filter(Boolean);

  return {
    id: key.id ?? raw.id ?? null,
    chatJid: key.remoteJid ?? raw.chatJid ?? null,
    senderJid:
      key.participant ??
      key.senderPn ??
      raw.senderJid ??
      raw.sender ??
      key.remoteJid ??
      null,
    fromMe: Boolean(key.fromMe ?? raw.fromMe),
    text: extractText(message),
    mentionedJids,
    quotedParticipant: context.participant ?? raw.quotedParticipant ?? null,
    quotedMessageId: context.stanzaId ?? raw.quotedMessageId ?? null,
    isGroup: String(key.remoteJid ?? raw.chatJid ?? '').endsWith('@g.us'),
    isProtocol: Boolean(message?.protocolMessage || message?.reactionMessage || message?.senderKeyDistributionMessage),
    isEphemeral: Boolean(envelope?.ephemeralMessage),
    isFromBot: Boolean(key.fromMe ?? raw.fromMe),
    botJid,
    raw,
  };
}

function extractText(message) {
  if (typeof message === 'string') return message;
  if (!message) return '';
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentWithCaptionMessage?.message?.documentMessage?.caption ??
    ''
  );
}
