import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Minimal atomic JSON file persistence. No dependencies.
 * Used by stores that need to survive restarts. Callers decide what persists;
 * passing no filePath keeps a store purely in-memory (useful for tests).
 */
export function loadJson(filePath, fallback) {
  try {
    if (filePath && existsSync(filePath)) return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    // Corrupt or unreadable file must never take the bot down.
    return fallback;
  }
  return fallback;
}

export function saveJson(filePath, data) {
  if (!filePath) return false;
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, filePath);
    return true;
  } catch {
    return false;
  }
}

/** Keeps only the last N entries of an array. */
export function capArray(array, max) {
  const limit = Math.max(1, Number(max) || 1);
  if (array.length > limit) array.splice(0, array.length - limit);
  return array;
}
