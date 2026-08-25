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

/** Masks a JID for safe terminal logs: "2347046855205@s…" -> "5093***8446@s.whatsapp.net". */
export function maskJid(jid = '') {
  const bare = bareJid(jid);
  const [local = '', server = ''] = bare.split('@');
  if (!local) return '(unknown)';
  const visible = local.length <= 6 ? local : `${local.slice(0, 4)}***${local.slice(-4)}`;
  return server ? `${visible}@${server}` : visible;
}

/**
 * Destination for the startup online card: the FIRST CONFIGURED OWNER as a
 * bare user JID. Strips device suffixes ("…:6@s.whatsapp.net") and domains
 * bare numbers. Returns '' when nothing configured — callers must skip the
 * send rather than fall back to the bot's own identity.
 */
export function ownerNotificationTarget(jids = []) {
  for (const raw of Array.isArray(jids) ? jids : []) {
    const bare = String(raw ?? '').trim().toLowerCase().replace(/:\d+(?=@)/, '');
    if (!bare) continue;
    return /^\d+$/.test(bare) ? `${bare}@s.whatsapp.net` : bare;
  }
  return '';
}
