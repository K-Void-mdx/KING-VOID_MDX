/**
 * Decides the ONLY moment a pairing code may be requested.
 *
 * Baileys proves the WebSocket upgrade AND noise handshake succeeded by
 * emitting a `qr` connection update. Requesting before that caused HTTP 405
 * upgrade failures; requesting on arbitrary timers races the handshake. So:
 * request only when (a) a qr update arrived, (b) credentials are not yet
 * registered, and (c) the operator's number for THIS pairing attempt exists.
 */
export function shouldRequestPairingCode(update, { registered = false, hasPhone = false } = {}) {
  return Boolean(update?.qr) && !registered && hasPhone;
}

/**
 * True when a connection.update belongs to the CURRENT socket generation.
 * Stale generations (from replaced sockets) must be ignored entirely so an
 * old socket's close/timeout can never kill or retry the newer one.
 */
export function isCurrentGeneration(update, expected) {
  if (!Number.isInteger(expected)) return false;
  return update?.generation === expected;
}
