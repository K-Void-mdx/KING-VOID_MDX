const ROLE_RANK = Object.freeze({
  user: 0,
  admin: 1,
  sudo: 2,
  owner: 3,
});

// Baileys JIDs may carry a device suffix ("2348012345678:12@s.whatsapp.net").
// Strip it so configured plain-number JIDs always match real senders.
export function normalizeJid(value = '') {
  return String(value).trim().toLowerCase().replace(/:\d+(?=@)/, '');
}

export function hasRole(role, requiredRole) {
  return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[requiredRole] ?? 999);
}

export function resolveRole({ sender, ownerJids = [], sudoJids = [], isGroupAdmin = false, botJids = [] }) {
  const jid = normalizeJid(sender);
  const owners = new Set(ownerJids.map(normalizeJid));
  const sudos = new Set(sudoJids.map(normalizeJid));
  // The bot's own account (any of its identities) is always owner-level:
  // it runs as a linked companion ON the owner's WhatsApp account.
  const selfIdentities = new Set(botJids.filter(Boolean).map(normalizeJid));

  if (selfIdentities.has(jid)) return 'owner';
  if (owners.has(jid)) return 'owner';
  if (sudos.has(jid)) return 'sudo';
  if (isGroupAdmin) return 'admin';
  return 'user';
}
