"use client";

import { HomeWatchlist } from "@/components/watchlist/home-watchlist";
import { useBoardState } from "@/hooks/use-board-state";
import { tickerDirectory } from "@/lib/ticker-search";

import * as React from "react";

import { ExploreNav } from "@/components/layout/explore-nav";
import { useLocale } from "@/components/locale-provider";
import { NavBar } from "@/components/layout/nav-bar";
import { Section } from "@/components/layout/section";
import { SiteFooter } from "@/components/layout/site-footer";
import { useStoredView } from "@/hooks/use-stored-view";

import type { EarningsEvent, WeekCalendar as WeekCalendarData } from "@/lib/econ-calendar";
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
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { ControlsBar } from "./controls-bar";
import { DataBasis } from "./data-basis";
import { IndexStrip } from "./index-strip";
import { SectorEtfMonitor } from "./sector-etf-monitor";
import { SectorTreemap } from "./sector-treemap";
import { SigmaOverview } from "./sigma-overview";
import { StockDetailPanel } from "./stock-detail-panel";
import { StockGrid } from "./stock-grid";
import { SummaryCards } from "./summary-cards";
import { WeekCalendar } from "./week-calendar";
import { WeeklyRecapTable } from "./weekly-recap-table";

interface DashboardProps {
  quotes: Quote[];
  sectorQuotes: SectorEtfQuote[];
  snapshot: MarketSnapshot;
  /** Absent when the calendar vendor could not be reached. */
  calendar: WeekCalendarData | null;
}


export function Dashboard({
  quotes,
  sectorQuotes,
  snapshot,
  calendar,
}: DashboardProps) {
  const { pick } = useLocale();
  const [liveQuotes, setLiveQuotes] = React.useState(quotes);
  const [liveSectorQuotes, setLiveSectorQuotes] = React.useState(sectorQuotes);
  const [meta, setMeta] = React.useState(snapshot);
  const [refreshError, setRefreshError] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const { query, setQuery, filter, setFilter, sort, setSort } = useBoardState();
  const [view, setView] = useStoredView();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [selectedEarnings, setSelectedEarnings] = React.useState<EarningsEvent | null>(null);

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
   * The band was struck at the most recent close and has not been traded yet —
   * the Saturday state, once the publisher rolls the anchor to Friday's close.
   *
   * Worth calling out rather than letting the page read as a result: every z is
   * 0 by construction, so a board with no dislocations means "the week has not
   * started", not "nothing is stretched".
   */
  const opening = meta.bandElapsed === 0;

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
    setRefreshError(false);
    try {
      const response = await fetch("/api/snapshot", { cache: "no-store" });
      if (!response.ok) throw new Error("Snapshot refresh failed");
      const next = (await response.json()) as SnapshotPayload;
      if (!Array.isArray(next.quotes) || !Array.isArray(next.sectorQuotes) || !next.snapshot?.generatedAt) throw new Error("Invalid snapshot");
      setLiveQuotes(next.quotes);
      setLiveSectorQuotes(next.sectorQuotes);
      setMeta(next.snapshot);
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const resetFilters = React.useCallback(() => {
    setQuery("");
    setFilter("ALL");
  }, [setQuery, setFilter]);

  return (
    <>
      <NavBar
        tickers={tickerDirectory([...stocks, ...etfs])}
        snapshot={meta}
        updatedAt={meta.updatedAt}
        onRefresh={refresh}
        refreshing={refreshing}
      />

      {/* `scroll-mt-28` clears the sticky header, which for `#top` means the
          jump lands at the document top rather than one header-height into it. */}
      <main
        id="top"
        className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col scroll-mt-28 px-4 pt-5 pb-4 sm:px-6 md:pt-14 lg:px-8"
      >
        {refreshError && <p role="alert" className="order-first mb-3 text-sm text-down">{pick("새로고침하지 못했습니다. 마지막으로 받은 데이터를 표시합니다.", "Refresh failed. Showing the last received data.")}</p>}

        {/* Source order below is the phone order, so the sequence a screen
            reader walks is the sequence on screen. `md:order-*` puts the desktop
            arrangement back: hero, calendar, benchmarks, counts, board. */}

        {/* Four indices are the cheapest read on the page and the frame for
            everything under them — a dozen names past +1σ means one thing if the
            index went with them and another if it did not. So they open the phone. */}
        <section
          aria-labelledby="benchmarks-label"
          className={cn(
            "order-1 transition-opacity duration-200 md:order-3 md:mt-8",
            refreshing && "opacity-70",
          )}
          aria-busy={refreshing}
        >
          <h1 className="text-xl font-semibold tracking-tight md:hidden">
            {pick("이번 주, 시장은 어디쯤?", "Where is the market this week?")}
          </h1>
          <p className="mt-2 mb-5 text-xs text-muted-foreground md:hidden">
            {pick("가격 기준", "Prices as of")}: {meta.sessionDate}{" "}
            {pick("미국 정규장 종가", "US regular-session close")}
          </p>
          <p id="benchmarks-label" className="label-xs mb-3">{pick("벤치마크", "Benchmarks")}</p>
          <IndexStrip stocks={stocks} onSelect={setSelected} />
        </section>

        {calendar && (
          <WeekCalendar
            calendar={calendar}
            bandAnchorDate={snapshot.bandAnchorDate}
            onSelect={(symbol, earnings) => { setSelectedEarnings(earnings); setSelected(symbol); }}
            className="order-2 mt-8 md:order-2"
          />
        )}

        <HomeWatchlist stocks={[...stocks, ...etfs]} />

          <Section
            id="watchlist"
            className="order-4 mt-9 md:order-5 md:mt-16"
            eyebrow={pick("워치리스트", "Watchlist")}
            title={pick("Sigma 모니터", "Sigma monitor")}
            description={pick("종목을 눌러 상세를 확인하세요. 등락은 전일 종가 대비, σ는 이번 주 밴드 기준입니다.", "Select a symbol for details. Change is versus the prior close; sigma uses this week’s band.")}
            action={
              <span className="num text-xs text-muted-foreground">
                {pick(`${counts.total}개 중 ${visible.length}개`, `${visible.length} of ${counts.total} symbols`)}
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
                view={view}
                onViewChange={setView}
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
                  view={view}
                  grouped={filter === "ALL"}
                  onReset={resetFilters}
                />
              </div>
            </div>
          </Section>

        <section id="market" className="order-5 mt-12 scroll-mt-28 md:order-1 md:mt-0">
          <h2 className="mb-5 text-xl font-semibold md:hidden">{pick("시장 요약", "Market summary")}</h2>
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] lg:gap-12">
            <div className="min-w-0">
              <p className="label-xs">
                {pick("밴드 기간", "Band window")} · {meta.bandWindow} · {pick("앵커", "anchored")} {meta.bandAnchor}
                {opening && pick(" · 월요일 개장", " · opens Monday")}
              </p>
              <h1 className="hidden md:block mt-3 font-heading text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
                <span className="text-gradient">
                  {pick("각 종목의 이번주 예상 주가 범위와 현재 위치", "Each stock’s expected price range this week and current position")}
                </span>
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {pick(
                  `${counts.total}개 종목을 각각의 주간 implied volatility 기준으로 측정합니다. `,
                  `${counts.total} symbols measured against their own implied volatility for the week. `,
                )}
                {opening ? (
                  <>
                    {pick(
                      `밴드는 ${meta.updatedAt}에 설정되어 다음 한 주를 커버합니다. 월요일 거래 전이라 모든 종목이 앵커에 있으며, 현재 카드는 결과가 아닌 범위를 보여줍니다.`,
                      `The band was struck at the ${meta.updatedAt} and covers the week ahead, so every symbol sits at its anchor until Monday trades. What each card shows now is the range, not a result.`,
                    )}
                  </>
                ) : (
                  <>
                    {pick(
                      `±1σ를 넘은 종목은 통상 거래 범위를 벗어난 것으로 분류해 먼저 보여줍니다. 가격은 ${meta.updatedAt} 기준이며 밴드는 매주 금요일 리셋됩니다.`,
                      `Anything past ±1σ has left the range it normally trades in — and is surfaced first. Prices are the ${meta.updatedAt}; the band resets each Friday.`,
                    )}
                  </>
                )}
              </p>

              <ExploreNav sessionDate={meta.sessionDate} className="mt-7" />
            </div>

            {/* Sits level with the bottom of the band copy rather than in a
                band of its own: what is scheduled this week is context for the
                sentence beside it, not a separate section to scroll to. */}
            <DataBasis snapshot={meta} className="max-w-md lg:justify-self-end" />
          </div>
        </section>

        <div
          className={cn(
            "order-6 mt-6 transition-opacity duration-200 md:order-4",
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
              opening={opening}
            />
          </div>
        </div>

        <div className="order-7 mt-12 space-y-16 sm:mt-20 sm:space-y-20 md:order-6">


          <Section
            id="lastweek"
            eyebrow={pick("최근 2주", "Last two weeks")}
            title={pick("주간 밴드 리캡", "Weekly band recap")}
            description={pick("종료된 지난 2주의 마감 위치와 현재 주간 밴드 위치를 함께 보여줍니다. 각 열은 해당 주의 앵커와 σ로 계산되어, 서로 다른 숫자 3개가 아니라 방향성으로 읽을 수 있습니다.", "Where each symbol closed out the two weeks that have already settled, next to where it sits in the band running now. Every column is scored against its own week's anchor and its own σ, so the row reads as a direction rather than three unrelated numbers.")}
            action={
              <span className="num text-xs text-muted-foreground">
                {pick(`${stocks.length}개 종목`, `${stocks.length} symbols`)}
              </span>
            }
          >
            <div
              className={cn(
                "transition-opacity duration-200",
                refreshing && "opacity-70",
              )}
              aria-busy={refreshing}
            >
              <WeeklyRecapTable stocks={stocks} onSelect={setSelected} />
            </div>
          </Section>

          <Section
            id="sectors"
            eyebrow={pick("섹터", "Sectors")}
            title={pick("섹터 ETF 모니터", "Sector ETF monitor")}
            description={pick("11개 SPDR 섹터 ETF를 같은 밴드에서 비교해 범위 이탈이 어디에 집중되는지 보여줍니다.", "The eleven SPDR sector funds on the same band, for a read on where the dislocation is concentrated.")}
          >
            <SectorEtfMonitor etfs={etfs} onSelect={setSelected} />
          </Section>

          <Section
            eyebrow={pick("섹터 맵", "Sector map")}
            title={pick("섹터 맵", "Sector map")}
            description={pick("전체 보드를 범위 이탈 크기로 표시합니다. 주간 범위를 벗어난 종목은 커지고, 앵커 근처의 종목은 작아집니다. 섹터는 범위 이탈 종목 수순으로 정렬됩니다.", "The whole board at once, sized by dislocation. A symbol that has left its weekly range takes up room; one sitting on its anchor shrinks away. Sectors are ordered by how many of their names have gone.")}
          >
            <SectorTreemap
              stocks={stocks}
              etfs={etfs}
              onSelect={setSelected}
            />
          </Section>
        </div>
      </main>

      <SiteFooter snapshot={snapshot} />

      <StockDetailPanel
        stock={selectedStock}
        earnings={selectedEarnings?.symbol === selected ? selectedEarnings : null}
        open={selected !== null}
        onOpenChange={(open) => { if (!open) { setSelected(null); setSelectedEarnings(null); } }}
      />
    </>
  );
}
