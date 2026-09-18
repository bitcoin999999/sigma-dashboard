"use client";

import { useSyncExternalStore } from "react";
import { normalizeSymbols, parseStoredSymbols, toggleSymbol, WATCHLIST_KEY } from "@/lib/watchlist";

type WatchlistState = { symbols: string[]; ready: boolean; persistent: boolean };
const SERVER: WatchlistState = { symbols: [], ready: false, persistent: true };
let current: WatchlistState | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
function read(): WatchlistState {
  if (!current) {
    try { current = { symbols: parseStoredSymbols(localStorage.getItem(WATCHLIST_KEY)), ready: true, persistent: true }; }
    catch { current = { symbols: [], ready: true, persistent: false }; }
  }
  return current;
}
function onStorage(event: StorageEvent) {
  if (event.key !== WATCHLIST_KEY && event.key !== null) return;
  current = null;
  notify();
}
function subscribe(listener: () => void) {
  if (!listeners.size) {
    // Re-read after routes without a watchlist subscriber. A failed write is
    // kept in memory for this visit and must not be discarded here.
    if (current?.persistent !== false) current = null;
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}
export function saveWatchlist(values: string[]) {
  const symbols = normalizeSymbols(values);
  let persistent = true;
  try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(symbols)); } catch { persistent = false; }
  current = { symbols, ready: true, persistent };
  notify();
}
export function toggleWatchlist(symbol: string) {
  saveWatchlist(toggleSymbol(read().symbols, symbol));
}
export function useWatchlist() {
  return useSyncExternalStore(subscribe, read, () => SERVER);
}
