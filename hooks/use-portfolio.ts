"use client";

import { useSyncExternalStore } from "react";
import { createLocalDocument } from "@/lib/local-document";
import {
  EMPTY_PORTFOLIO,
  PORTFOLIO_KEY,
  PORTFOLIO_LEGACY_KEY,
  isLegacyPortfolio,
  parsePortfolio,
  type PortfolioDocument,
} from "@/lib/portfolio";

/** One store per page load, shared by the tabs, the home glance and the editor. */
const store = createLocalDocument(PORTFOLIO_KEY, EMPTY_PORTFOLIO, parsePortfolio);

export type PortfolioSaveResult = "saved" | "memory" | "conflict" | "invalid" | "unavailable";

function commit(next: PortfolioDocument): PortfolioSaveResult {
  const current = store.getSnapshot();
  // The first v2 write replaces a v1 document, and `:backup` only ever holds
  // the previous edit. Keep the original v1 once, where nothing rewrites it.
  if (isLegacyPortfolio(current.raw)) {
    try { if (localStorage.getItem(PORTFOLIO_LEGACY_KEY) === null) localStorage.setItem(PORTFOLIO_LEGACY_KEY, current.raw!); } catch { /* the save below reports storage */ }
  }
  const error = store.save({ ...next, revision: current.value.revision + 1 }, current.raw);
  return error === null ? "saved" : error === "storage_unavailable" ? "memory" : error === "conflict" ? "conflict" : "invalid";
}

/**
 * Every edit is written straight away — there is no draft and no save button.
 * The mutator receives the latest stored document, so a change made in another
 * tab is the base for this one rather than something to overwrite.
 */
export function updatePortfolio(mutate: (doc: PortfolioDocument) => PortfolioDocument): PortfolioSaveResult {
  const current = store.getSnapshot();
  if (!current.ready || current.error === "corrupt") return "unavailable";
  const next = mutate(current.value);
  return next === current.value ? "saved" : commit(next);
}

/** Replaces the whole document, e.g. from an imported backup — also over an unreadable one. */
export function replacePortfolio(doc: PortfolioDocument): PortfolioSaveResult {
  return store.getSnapshot().ready ? commit(doc) : "unavailable";
}

export function usePortfolio() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
