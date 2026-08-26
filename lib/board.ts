import { cache } from "react";

import { loadSnapshot } from "@/lib/snapshot";
import { buildStockList } from "@/lib/sigma";
import type { MarketSnapshot, StockData } from "@/lib/types";

export interface Board {
  snapshot: MarketSnapshot;
  /** The watchlist names, in publish order. */
  stocks: StockData[];
  /** The eleven SPDR sector funds, scored on the same band. */
  etfs: StockData[];
  /** Everything the board knows about. The two lists never overlap. */
  all: StockData[];
}

/**
 * The whole board, scored, memoised for the length of one request.
 *
 * Every route below `app/` reads the snapshot at least twice — once in
 * `generateMetadata`, once in the page body, and a third time for a share
 * image. Without the memo each of those is a separate uncached blob fetch, and
 * a publish landing mid-render would let a page describe one snapshot in its
 * `<title>` and a different one in its body.
 */
export const loadBoard = cache(async (): Promise<Board> => {
  const { quotes, sectorQuotes, snapshot } = await loadSnapshot();

  const stocks = buildStockList(quotes);
  const etfs = buildStockList(sectorQuotes);

  return { snapshot, stocks, etfs, all: [...stocks, ...etfs] };
});

/** Case-insensitive lookup across watchlist and sector funds alike. */
export async function findStock(symbol: string): Promise<StockData | null> {
  const wanted = symbol.trim().toUpperCase();
  if (!wanted) return null;

  const { all } = await loadBoard();
  return all.find((stock) => stock.symbol === wanted) ?? null;
}
