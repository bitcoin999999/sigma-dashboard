import "server-only";
import { currentHistory, mergeMarketHistory, validMarketHistory } from "./market-history";
import type { MarketSnapshot, StockData } from "./types";
export async function loadMarketHistory(stock: StockData, snapshot: MarketSnapshot) {
  const current = currentHistory(stock,snapshot);
  const source = process.env.SNAPSHOT_URL;
  if (!source) return current;
  try {
    const url = new URL(`history/${encodeURIComponent(stock.symbol)}.json`,source);
    const response = await fetch(url,{ next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return current;
    const value: unknown = await response.json();
    return mergeMarketHistory(validMarketHistory(value,stock.symbol) ? value : null,current);
  } catch { return current; }
}
