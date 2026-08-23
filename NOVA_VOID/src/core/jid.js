/** Strips Baileys device suffixes: "509…:6@s.whatsapp.net" -> "509…@s.whatsapp.net". */
export function bareJid(jid = '') {
  return String(jid ?? '').replace(/:\d+(?=@)/, '');
}

/**
 * True when the message targets a WhatsApp broadcast/status channel that the
 * dispatcher must never process.
 */
export function isBroadcastChat(chatJid = '') {
  const jid = String(chatJid ?? '');
  return jid === 'status@broadcast' || jid === 'status@distributed' || jid.endsWith('@broadcast');
}

/** Masks a JID for safe terminal logs: "50932528446@s…" -> "5093***8446@s.whatsapp.net". */
export function maskJid(jid = '') {
  const bare = bareJid(jid);
  const [local = '', server = ''] = bare.split('@');
  if (!local) return '(unknown)';
  const visible = local.length <= 6 ? local : `${local.slice(0, 4)}***${local.slice(-4)}`;
  return server ? `${visible}@${server}` : visible;
}
