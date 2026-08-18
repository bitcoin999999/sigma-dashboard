"use client";

import * as React from "react";

import { NavBar } from "@/components/layout/nav-bar";
import { Section } from "@/components/layout/section";
import { SiteFooter } from "@/components/layout/site-footer";

import type { SnapshotPayload } from "@/lib/snapshot";
import {
  FILTER_OPTIONS,
  buildStockData,
  buildStockList,
  filterStocks,
  sortStocks,
  summarize,
} from "@/lib/sigma";
import type {
  FilterKey,
  MarketSnapshot,
  Quote,
  SectorEtfData,
  SectorEtfQuote,
  SortKey,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { ControlsBar } from "./controls-bar";
import { SectorEtfMonitor } from "./sector-etf-monitor";
import { SectorHeatmap } from "./sector-heatmap";
import { SigmaOverview } from "./sigma-overview";
import { StockDetailPanel } from "./stock-detail-panel";
import { StockGrid } from "./stock-grid";
import { SummaryCards } from "./summary-cards";

interface DashboardProps {
  quotes: Quote[];
  sectorQuotes: SectorEtfQuote[];
  snapshot: MarketSnapshot;
}

export function Dashboard({ quotes, sectorQuotes, snapshot }: DashboardProps) {
  const [liveQuotes, setLiveQuotes] = React.useState(quotes);
  const [liveSectorQuotes, setLiveSectorQuotes] = React.useState(sectorQuotes);
  const [meta, setMeta] = React.useState(snapshot);
  const [refreshing, setRefreshing] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterKey>("ALL");
  const [sort, setSort] = React.useState<SortKey>("ZSCORE");
  const [selected, setSelected] = React.useState<string | null>(null);

  const stocks = React.useMemo(() => buildStockList(liveQuotes), [liveQuotes]);

  const etfs = React.useMemo<SectorEtfData[]>(
    () =>
      liveSectorQuotes.map((quote) => ({
        ...buildStockData(quote),
        sectorLabel: quote.sectorLabel,
      })),
    [liveSectorQuotes],
  );

  const counts = React.useMemo(() => summarize(stocks), [stocks]);

  /**
   * The same band scored at the prior session's close. σ and the anchor are
   * fixed for the week, so re-running the quotes at `previousClose` gives the
   * real day-over-day move in each bucket rather than a stored guess.
   */
  const previousCounts = React.useMemo(
    () =>
      summarize(
        buildStockList(
          liveQuotes.map((quote) => ({ ...quote, price: quote.previousClose })),
        ),
      ),
    [liveQuotes],
  );

  const filterCounts = React.useMemo(
    () =>
      Object.fromEntries(
        FILTER_OPTIONS.map((option) => [
          option.key,
          filterStocks(stocks, option.key, "").length,
        ]),
      ) as Record<FilterKey, number>,
    [stocks],
  );

  const visible = React.useMemo(
    () => sortStocks(filterStocks(stocks, filter, query), sort),
    [stocks, filter, query, sort],
  );

  const selectedStock = React.useMemo(() => {
    if (!selected) return null;
    return (
      stocks.find((stock) => stock.symbol === selected) ??
      etfs.find((etf) => etf.symbol === selected) ??
      null
    );
  }, [selected, stocks, etfs]);

  /**
   * The snapshot only moves once a day, after the close — this re-reads the
   * file the daily job writes rather than polling a live quote stream.
   */
  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/snapshot", { cache: "no-store" });
      const next = (await response.json()) as SnapshotPayload;
      setLiveQuotes(next.quotes);
      setLiveSectorQuotes(next.sectorQuotes);
      setMeta(next.snapshot);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const resetFilters = React.useCallback(() => {
    setQuery("");
    setFilter("ALL");
  }, []);

  return (
    <>
      <NavBar
        snapshot={meta}
        updatedAt={meta.updatedAt}
        onRefresh={refresh}
        refreshing={refreshing}
      />

      <main
        id="top"
        className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-10 pb-4 sm:px-6 sm:pt-14 lg:px-8"
      >
        <section id="market" className="scroll-mt-24">
          <div className="max-w-2xl">
            <p className="label-xs">
              Band window · {meta.bandWindow} · anchored {meta.bandAnchor}
              {meta.settled && " · settled"}
            </p>
            <h1 className="mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
              <span className="text-gradient">
                Where the market sits inside its own range.
              </span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {counts.total} symbols measured against their own implied
              volatility for the week. Anything past ±1σ has left the range it
              normally trades in — and is surfaced first. Prices are the{" "}
              {meta.updatedAt}; the band resets each Friday.
            </p>
          </div>

          <div
            className={cn(
              "mt-9 transition-opacity duration-200",
              refreshing && "opacity-70",
            )}
            aria-busy={refreshing}
          >
            <SummaryCards
              counts={counts}
              previousCounts={previousCounts}
              stocks={stocks}
            />

            <div className="mt-3">
              <SigmaOverview
                stocks={stocks}
                counts={counts}
                onSelect={setSelected}
              />
            </div>
          </div>
        </section>

        <div className="mt-16 space-y-16 sm:mt-20 sm:space-y-20">
          <Section
            id="watchlist"
            eyebrow="Watchlist"
            title="Sigma monitor"
            description="Every tracked symbol with its live position on the band. Overheated and oversold names float to the top."
            action={
              <span className="num text-xs text-muted-foreground">
                {visible.length} of {counts.total} symbols
              </span>
            }
          >
            <div className="space-y-5">
              <ControlsBar
                query={query}
                onQueryChange={setQuery}
                filter={filter}
                onFilterChange={setFilter}
                sort={sort}
                onSortChange={setSort}
                filterCounts={filterCounts}
              />

              <div
                className={cn(
                  "transition-opacity duration-200",
                  refreshing && "opacity-70",
                )}
                aria-busy={refreshing}
              >
                <StockGrid
                  stocks={visible}
                  onSelect={setSelected}
                  onReset={resetFilters}
                />
              </div>
            </div>
          </Section>

          <Section
            id="sectors"
            eyebrow="Sectors"
            title="Sector ETF monitor"
            description="The eleven SPDR sector funds on the same band, for a read on where the dislocation is concentrated."
          >
            <SectorEtfMonitor etfs={etfs} onSelect={setSelected} />
          </Section>

          <Section
            eyebrow="Sector map"
            title="Sector heatmap"
            description="Sorted by z-score. Tint intensity tracks distance from the anchor close; hue carries direction."
          >
            <SectorHeatmap etfs={etfs} onSelect={setSelected} />
          </Section>
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />

      <StockDetailPanel
        stock={selectedStock}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}
