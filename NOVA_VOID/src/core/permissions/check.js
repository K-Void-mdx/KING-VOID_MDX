import { normalizeJid } from './roles.js';

export function createPermissionChecker({ ownerJids = [], sudoJids = [] } = {}) {
  const owners = new Set(ownerJids.map(normalizeJid));
  const sudos = new Set(sudoJids.map(normalizeJid));
  return {
    isOwner(jid) {
      return owners.has(normalizeJid(jid));
    },
    isSudo(jid) {
      return sudos.has(normalizeJid(jid));
    },
  };
}
