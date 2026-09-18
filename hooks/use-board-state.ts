"use client";

import { useEffect, useSyncExternalStore } from "react";
import { FILTER_OPTIONS, SORT_OPTIONS } from "@/lib/sigma";
import type { FilterKey, SortKey } from "@/lib/types";
import { rememberBoardScroll } from "@/lib/board-navigation";

const KEY = "sigma-dashboard:board";
type BoardState = { query: string; filter: FilterKey; sort: SortKey };
const DEFAULT: BoardState = { query: "", filter: "ALL", sort: "ZSCORE" };
let current: BoardState | null = null;
const listeners = new Set<() => void>();
function getSnapshot() {
  if (!current) {
    current = DEFAULT;
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
      if (raw && typeof raw.query === "string" && FILTER_OPTIONS.some((o) => o.key === raw.filter) && SORT_OPTIONS.some((o) => o.key === raw.sort)) current = { query: raw.query, filter: raw.filter, sort: raw.sort };
    } catch { /* In-memory state still supports client-side back navigation. */ }
  }
  return current;
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function update(patch: Partial<BoardState>) {
  current = { ...getSnapshot(), ...patch };
  try { sessionStorage.setItem(KEY, JSON.stringify(current)); } catch { /* Memory fallback. */ }
  listeners.forEach((listener) => listener());
}
export function useBoardState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT);
  useEffect(() => {
    let frame = 0;
    const restore = () => {
      const y = history.state?.sigmaBoardScroll;
      if (location.pathname !== "/" || typeof y !== "number") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" })); });
    };
    const remember = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest("a[href]");
      if (!link) return;
      const next = new URL(link.getAttribute("href")!, location.href);
      if (next.origin !== location.origin || next.pathname === "/") return;
      rememberBoardScroll();
    };
    restore();
    document.addEventListener("click", remember, true);
    window.addEventListener("popstate", restore);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("click", remember, true); window.removeEventListener("popstate", restore); };
  }, []);
  return { ...state, setQuery: (query: string) => update({ query }), setFilter: (filter: FilterKey) => update({ filter }), setSort: (sort: SortKey) => update({ sort }) };
}
