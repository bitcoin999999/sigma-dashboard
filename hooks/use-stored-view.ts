"use client";

import * as React from "react";

import type { ViewMode } from "@/lib/types";

const STORAGE_KEY = "sigma-dashboard:view";

/**
 * In-memory mirror of the stored preference, and the real source of truth.
 *
 * Reading `localStorage` on every `getSnapshot` would be both wasteful and
 * wrong — the hook requires a value that is stable between writes, and a fresh
 * read that throws (private browsing, blocked storage) would make the snapshot
 * unstable. Keeping the value here also means the toggle still works when
 * storage is unavailable; it just will not survive a reload.
 *
 * `null` means "not read yet", which is also the state a cross-tab write
 * returns it to.
 */
let current: ViewMode | null = null;

/** Same-tab subscribers. The `storage` event only fires in *other* tabs. */
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    current = null; // Re-read on the next snapshot.
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): ViewMode {
  if (current === null) {
    try {
      current = window.localStorage.getItem(STORAGE_KEY) === "LIST"
        ? "LIST"
        : "CARD";
    } catch {
      current = "CARD";
    }
  }
  return current;
}

/**
 * The server has no storage to read, so it always renders cards. A reader who
 * chose the list sees one frame of cards before hydration corrects it — the
 * alternative is markup that disagrees with the client's first paint, which is
 * a far worse trade for a layout preference.
 */
function getServerSnapshot(): ViewMode {
  return "CARD";
}

/** Watchlist layout, remembered across visits and synced across open tabs. */
export function useStoredView(): [ViewMode, (next: ViewMode) => void] {
  const view = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const update = React.useCallback((next: ViewMode) => {
    current = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage is a convenience here. Losing the preference must not stop the
      // view from switching, so the in-memory value above already stands.
    }
    notify();
  }, []);

  return [view, update];
}
