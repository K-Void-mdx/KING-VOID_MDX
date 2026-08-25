const ROLE_RANK = Object.freeze({
  user: 0,
  admin: 1,
  sudo: 2,
  owner: 3,
});

// Baileys JIDs may carry a device suffix ("2348012345678:12@s.whatsapp.net").
// Strip it so configured plain-number JIDs always match real senders.
export function normalizeJid(value = '') {
  let jid = String(value).trim().toLowerCase().replace(/:\d+(?=@)/, '');
  // Domainless numbers (e.g. a phone number typed without @s.whatsapp.net)
  // are treated as standard user JIDs so every representation of the same
  // account resolves identically.
  if (/^\d+$/.test(jid)) jid = `${jid}@s.whatsapp.net`;
  return jid;
}

export function hasRole(role, requiredRole) {
  return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[requiredRole] ?? 999);
}

/**
 * Resolve a sender's role from CONFIGURED lists only.
 *
 * Three identities stay deliberately separate:
 *  A. Configured permissions  → OWNER_JIDS / SUDO_JIDS (permanent authority).
 *  B. Linked bot companion    → session-derived identity of the paired
 *    account. It is NOT configured authority: messages typed on the linked
 *    phone dispatch at USER tier unless the sender also appears in the
 *    configured lists.
 *  C. Bot outbound echoes     → suppressed by tracked message IDs in
 *    application.js, never by role.
 */
export function resolveRole({ sender, ownerJids = [], sudoJids = [], isGroupAdmin = false }) {
  const jid = normalizeJid(sender);
  const owners = new Set(ownerJids.map(normalizeJid));
  const sudos = new Set(sudoJids.map(normalizeJid));

  if (owners.has(jid)) return 'owner';
  if (sudos.has(jid)) return 'sudo';
  if (isGroupAdmin) return 'admin';
  return 'user';
}
