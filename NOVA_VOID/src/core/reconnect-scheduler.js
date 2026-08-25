/**
 * Single-flight reconnect scheduler.
 *
 * Guarantees, independent of call-site discipline:
 *  - at most ONE pending timer exists at any moment (rescheduling cancels);
 *  - a callback armed by an older generation can never fire after a newer
 *    schedule/cancel (stale-timeout protection across socket generations).
 *
 * Timers are injectable so tests can prove both properties without real time.
 */
export function createReconnectScheduler({ timers, onFire }) {
  if (!timers || typeof timers.set !== 'function' || typeof timers.clear !== 'function') {
    throw new Error('createReconnectScheduler requires { timers: { set, clear } }');
  }
  if (typeof onFire !== 'function') {
    throw new Error('createReconnectScheduler requires onFire');
  }

  let handle;
  let generation = 0;

  return {
    schedule(delayMs = 0) {
      this.cancel();
      const myGeneration = ++generation;
      handle = timers.set(() => {
        // A stale callback (superseded by reschedule/cancel) must no-op.
        if (myGeneration !== generation) return;
        handle = undefined;
        onFire();
      }, delayMs);
    },
    cancel() {
      if (handle !== undefined) {
        timers.clear(handle);
        handle = undefined;
      }
      generation += 1; // orphan any already-detached callback
    },
    get pending() {
      return handle !== undefined;
    },
    get generation() {
      return generation;
    },
  };
}
