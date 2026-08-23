import { readFile, writeFile } from 'node:fs/promises';

export const VERSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Validates a cached version record. Returns the version array or undefined.
 * Pure so it is testable without touching the filesystem.
 */
export function parseCachedVersion(raw, now = Date.now(), ttl = VERSION_TTL_MS) {
  try {
    const parsed = JSON.parse(String(raw));
    const { version, fetchedAt } = parsed ?? {};
    if (!Array.isArray(version) || version.length !== 3 || !version.every(Number.isInteger)) return undefined;
    if (typeof fetchedAt !== 'number' || Number.isNaN(fetchedAt)) return undefined;
    if (now - fetchedAt > ttl) return undefined;
    return version;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the WA protocol version to connect with.
 * Order: fresh disk cache -> single small HTTP check (~2 KB) -> undefined
 * (Baileys falls back to its baked-in version). Keeps boots offline-friendly:
 * at most one tiny fetch per TTL window.
 */
export async function loadWaVersion({ file, fetchVersion, ttl = VERSION_TTL_MS, io = { readFile, writeFile } } = {}) {
  try {
    const cached = parseCachedVersion(await io.readFile(file, 'utf8'), Date.now(), ttl);
    if (cached) return { version: cached, source: 'cache' };
  } catch {
    // no cache yet — expected on first run
  }
  try {
    const { version } = await fetchVersion();
    await io.writeFile(file, JSON.stringify({ version, fetchedAt: Date.now() }), 'utf8');
    return { version, source: 'network' };
  } catch {
    return { version: undefined, source: 'fallback' };
  }
}
