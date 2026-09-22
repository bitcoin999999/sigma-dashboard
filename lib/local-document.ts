/** A failed/corrupt write never silently replaces the last stored document. */
export function createLocalDocument<T>(key: string, empty: T, decode: (raw: string) => T) {
  type State = { value: T; ready: boolean; raw: string | null; error: string | null };
  const server: State = { value: empty, ready: false, raw: null, error: null };
  let state: State = server;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach(fn => fn());
  function read(): State {
    if (state.ready) return state;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
      state = { value: raw === null ? empty : decode(raw), ready: true, raw, error: null };
    } catch { state = { value: empty, ready: true, raw, error: raw === null ? "storage_unavailable" : "corrupt" }; }
    return state;
  }
  function storage(event: StorageEvent) {
    if (event.key !== key && event.key !== null) return;
    state = server; read(); notify();
  }
  return {
    getSnapshot: read, getServerSnapshot: () => server,
    subscribe(fn: () => void) {
      if (!listeners.size) { state = server; window.addEventListener("storage", storage); }
      listeners.add(fn);
      return () => { listeners.delete(fn); if (!listeners.size) window.removeEventListener("storage", storage); };
    },
    save(value: T, expectedRaw: string | null): string | null {
      try {
        const old = localStorage.getItem(key);
        if (old !== expectedRaw) { state = server; read(); notify(); return "conflict"; }
        const raw = JSON.stringify(value); decode(raw);
        if (old !== null) localStorage.setItem(`${key}:backup`, old);
        localStorage.setItem(key, raw);
        state = { value, ready: true, raw, error: null }; notify(); return null;
      } catch { return "storage_unavailable"; }
    },
  };
}
