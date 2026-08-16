const ROLE_RANK = Object.freeze({
  user: 0,
  admin: 1,
  sudo: 2,
  owner: 3,
});

export function normalizeJid(value = '') {
  return String(value).trim().toLowerCase();
}

export function hasRole(role, requiredRole) {
  return (ROLE_RANK[role] ?? -1) >= (ROLE_RANK[requiredRole] ?? 999);
}

export function resolveRole({ sender, ownerJids = [], sudoJids = [], isGroupAdmin = false }) {
  const jid = normalizeJid(sender);
  const owners = new Set(ownerJids.map(normalizeJid));
  const sudos = new Set(sudoJids.map(normalizeJid));

  if (owners.has(jid)) return 'owner';
  if (sudos.has(jid)) return 'sudo';
  if (isGroupAdmin) return 'admin';
  return 'user';
}
