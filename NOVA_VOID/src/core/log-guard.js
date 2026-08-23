const SENSITIVE_HINTS = [
  'Closing session:',
  'Opening session:',
  'Migrating session to:',
  'Removing old closed session:',
  'SessionEntry',
  'privKey',
  'signedPreKey',
];

/**
 * libsignal prints raw session records (private key material) straight to the
 * console, bypassing every logger level. This wraps console methods so those
 * dumps are suppressed app-wide while normal output passes through.
 * Returns { restore, suppressed } for tests.
 */
export function installLogGuard(target = console) {
  let suppressed = 0;
  const isSensitive = (args) =>
    args.some(
      (arg) =>
        typeof arg === 'string' &&
        SENSITIVE_HINTS.some((hint) => arg.includes(hint))
    );

  const methods = ['info', 'log', 'debug', 'warn', 'error'];
  const original = Object.fromEntries(methods.map((m) => [m, target[m]?.bind(target)]));

  for (const method of methods) {
    if (typeof original[method] !== 'function') continue;
    target[method] = (...args) => {
      if (isSensitive(args)) {
        suppressed += 1;
        return;
      }
      original[method](...args);
    };
  }

  return {
    restore() {
      for (const method of methods) {
        if (original[method]) target[method] = original[method];
      }
    },
    get suppressed() {
      return suppressed;
    },
  };
}
