import "server-only";
import { currentHistory, mergeMarketHistory, validMarketHistory } from "./market-history";
import type { MarketSnapshot, StockData } from "./types";
export async function loadMarketHistory(stock: StockData, snapshot: MarketSnapshot) {
  const current = currentHistory(stock,snapshot);
  const source = process.env.SNAPSHOT_URL;
  if (!source) return current;
  // The archive is published independently, including same-session backfills.
  // A per-symbol SWR cache could serve the old, short archive on the first visit.
  // Read the current static deployment, just as we do for the latest snapshot.
  let failure: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const url = new URL(`history/${encodeURIComponent(stock.symbol)}.json`,source);
      const response = await fetch(url,{ cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value: unknown = await response.json();
      if (!validMarketHistory(value,stock.symbol)) throw new Error("Invalid history");
      return mergeMarketHistory(value,current);
    } catch (error) { failure = error; }
  }
  console.warn(`[market-history] ${stock.symbol}: archive unavailable`, failure instanceof Error ? failure.message : "unknown failure");
  return { ...current, archiveUnavailable: true };
}
