"use client";

import { useStoredView } from "@/hooks/use-stored-view";
import type { StockData } from "@/lib/types";

import { StockCard } from "./stock-card";
import { GRID } from "./stock-grid";
import { StockTable } from "./stock-table";
import { ViewToggle } from "./view-toggle";

interface ScreenerResultsProps {
  stocks: StockData[];
  /** Denominator for the count line — the whole board, not the hits. */
  total: number;
}

/**
 * The hits, in whichever layout the reader last chose.
 *
 * Shares `useStoredView` with the board on purpose: someone who switched the
 * watchlist to rows wants rows here too, and a list that is twenty-five cards
 * long is exactly where that preference matters most.
 *
 * The screener pages are server-rendered and have no detail panel, so both
 * layouts link out to `/symbol/*` rather than opening one in place. That also
 * keeps a crawlable link per symbol in either view.
 */
export function ScreenerResults({ stocks, total }: ScreenerResultsProps) {
  const [view, setView] = useStoredView();

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="font-heading text-xl font-semibold tracking-[-0.02em]">
          Results
        </h2>
        <div className="flex items-center gap-3">
          <span className="num text-xs text-muted-foreground">
            {stocks.length} of {total} symbols
          </span>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {view === "LIST" ? (
        <StockTable stocks={stocks} hrefFor={(symbol) => `/symbol/${symbol}`} />
      ) : (
        <div className={GRID}>
          {stocks.map((stock) => (
            // The card renders as the link itself rather than being wrapped in
            // one, so there is exactly one interactive element per card.
            <StockCard
              key={stock.symbol}
              stock={stock}
              href={`/symbol/${stock.symbol}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
