/** A failed/corrupt write never silently replaces the last stored document. */
export function createLocalDocument<T>(key: string, empty: T, decode: (raw: string) => T) {
  /** `persistent: false` means the browser refused storage and edits live in memory for this visit. */
  type State = { value: T; ready: boolean; raw: string | null; error: string | null; persistent: boolean };
  const server: State = { value: empty, ready: false, raw: null, error: null, persistent: true };
  let state: State = server;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(fn => fn());
  function read(): State {
    if (state.ready) return state;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
      state = { value: raw === null ? empty : decode(raw), ready: true, raw, error: null, persistent: true };
    } catch { state = { value: empty, ready: true, raw, error: raw === null ? "storage_unavailable" : "corrupt", persistent: raw !== null }; }
    return state;
  }
  function storage(event: StorageEvent) {
    if (event.key !== key && event.key !== null) return;
    state = server; read(); notify();
  }
  return {
    getSnapshot: read, getServerSnapshot: () => server,
    subscribe(fn: () => void) {
      if (!listeners.size && state.persistent) { state = server; window.addEventListener("storage", storage); }
      listeners.add(fn);
      return () => { listeners.delete(fn); if (!listeners.size) window.removeEventListener("storage", storage); };
    },
    save(value: T, expectedRaw: string | null): string | null {
      const raw = JSON.stringify(value);
      try { decode(raw); } catch { return "invalid"; }
      try {
        const old = localStorage.getItem(key);
        if (old !== expectedRaw) { state = server; read(); notify(); return "conflict"; }
        if (old !== null) localStorage.setItem(`${key}:backup`, old);
        localStorage.setItem(key, raw);
        state = { value, ready: true, raw, error: null, persistent: true }; notify(); return null;
      } catch {
        // Keep the edit for this visit instead of dropping it. The stored copy,
        // if the browser still has one, is left exactly as it was.
        state = { ...state, value, ready: true, error: null, persistent: false }; notify(); return "storage_unavailable";
      }
    },
  };
}
