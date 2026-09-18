"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { opensPanel } from "@/lib/stock-navigation";
import { WatchButton } from "@/components/watchlist/watch-button";
import { Anchor } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import {
  formatBandWidth,
  formatCurrency,
  formatPercent,
  formatSigma,
} from "@/lib/format";
import { findGexFloor } from "@/lib/gex-floor";
import { STATUS_COPY } from "@/lib/i18n";
import { statusStyle, type SectorGroup } from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { rememberBoardScroll } from "@/lib/board-navigation";

import { SectorHeading } from "./sector-heading";
import { SigmaRangeBar } from "./sigma-range-bar";
import { StatusBadge } from "./status-badge";

/** Every column the header declares — the width a separator row has to span. */
const COLUMNS = 8;

interface StockTableProps {
  stocks: StockData[];
  /**
   * Breaks the rows into sector blocks under separator headings.
   *
   * One table rather than one per sector, because the point of the list view is
   * scanning a column of σ readings top to bottom, and fourteen tables would
   * each pick their own column widths and repeat the header fourteen times.
   */
  groups?: SectorGroup[];
  /** Opens the detail panel in place. Ignored when `hrefFor` is given. */
  onSelect?: (symbol: string) => void;
  /**
   * Per-symbol destination. When given, rows navigate instead of opening a
   * panel — used by the server-rendered screener pages, which have no panel.
   *
   * The symbol cell becomes a real `<a>` rather than a button wired to the
   * router, so the list still hands a crawler one link per symbol.
   */
  hrefFor?: (symbol: string) => string;
}

/**
 * The watchlist as rows instead of cards.
 *
 * Same data, same ordering — `Dashboard` sorts and filters before either view
 * sees the list, so switching between them never changes what is on screen or
 * in what order. The difference is only density: a card gives one symbol room
 * to breathe, a row lets a column of σ readings be scanned top to bottom.
 *
 * Column priority as the viewport narrows, widest first to drop: the band
 * range, then the price, then the status badge. What survives on a phone is
 * symbol, change and σ — the three that answer "did this leave its range".
 */
export function StockTable({
  stocks,
  groups,
  onSelect,
  hrefFor,
}: StockTableProps) {
  const { pick } = useLocale();
  return (
    <div className="glass overflow-hidden p-0">
      <div className="sm:overflow-x-auto">
        {/* Fixed layout on phones only. Auto layout sizes the symbol column to
            the longest company name, which pushed the table 90px past the
            viewport and put σ — the column the view exists for — behind a
            sideways swipe. Fixed caps it and lets the name truncate instead.
            From `sm` up there is room, so the natural widths come back. */}
        <table className="w-full table-fixed border-collapse text-left sm:table-auto">
          <caption className="sr-only">
            {pick("현재 필터에 맞는 종목의 가격, 일일 등락, ±1σ 밴드와 현재 위치", "Every symbol matching the current filter, with its price, daily change, ±1σ band and current position inside it.")}
          </caption>
          <thead>
            <tr className="border-b border-border/60">
              <Th className="w-11 sm:w-auto"><span className="sr-only">{pick("관심", "Watch")}</span></Th>
              <Th className="pl-4">{pick("종목", "Symbol")}</Th>
              <Th align="right" className="hidden sm:table-cell">
                {pick("가격", "Price")}
              </Th>
              <Th align="right" className="w-[4.5rem] sm:w-auto">{pick("등락", "Change")}</Th>
              <Th align="right" className="hidden lg:table-cell">
                ±1σ {pick("범위", "range")}
              </Th>
              {/* The bar is the one cell that should absorb slack as the table
                  widens, so it is the only one without a natural width. */}
              <Th className="hidden w-[26%] pl-6 md:table-cell">{pick("밴드", "Band")}</Th>
              {/* Matches the cell's gutter exactly — the status column takes it
                  over at xl, and until then a bare header sits flush to the
                  card edge while the numbers under it are inset.

                  The left gutter is for phones, where every intervening column
                  is hidden and σ would otherwise butt straight up against the
                  change figure — two right-aligned numbers touching, which
                  reads as one. */}
              <Th align="right" className="w-20 pl-2 pr-3 sm:w-auto sm:pl-5 sm:pr-4 xl:pr-0">
                σ
              </Th>
              <Th align="right" className="hidden pr-4 xl:table-cell">
                {pick("상태", "Status")}
              </Th>
            </tr>
          </thead>
          {groups ? (
            groups.map((group) => (
              <tbody key={group.sector}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={COLUMNS}
                    className="border-b border-border/60 bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)] px-4 pt-3"
                  >
                    <SectorHeading
                      group={group}
                      className="mb-1 border-0 pb-0"
                    />
                  </th>
                </tr>
                {group.stocks.map((stock) => (
                  <Row
                    key={stock.symbol}
                    stock={stock}
                    onSelect={onSelect}
                    href={hrefFor?.(stock.symbol)}
                    showSector={false}
                  />
                ))}
              </tbody>
            ))
          ) : (
            <tbody>
              {stocks.map((stock) => (
                <Row
                  key={stock.symbol}
                  stock={stock}
                  onSelect={onSelect}
                  href={hrefFor?.(stock.symbol)}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

function Row({
  stock,
  onSelect,
  href,
  showSector = true,
}: {
  stock: StockData;
  onSelect?: (symbol: string) => void;
  href?: string;
  showSector?: boolean;
}) {
  const { locale, pick } = useLocale();
  const router = useRouter();
  const isExtreme =
    stock.status === "OVERHEATED" || stock.status === "OVERSOLD";
  const floor = findGexFloor(stock);

  const label = `${stock.symbol}, ${stock.name}. ${STATUS_COPY[locale][stock.status].longLabel}.${
    floor ? pick(" −1σ 하단에 GEX floor.", " GEX floor on the −1σ edge.") : ""
  } ${href ? pick("페이지 열기.", "Open page.") : pick("상세 열기.", "Open details.")}`;

  // Whichever tag the symbol cell wears, the rest of the row is dead space
  // otherwise — a σ reading is not something you can click, and readers aim at
  // the number they came for rather than the ticker beside it.
  const cellClass =
    "cursor-pointer rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  const symbolBody = (
    <>
      <span className="num text-[13px] font-semibold">{stock.symbol}</span>
      {/* Says what the purple rail on this row means. */}
      {floor && (
        <Anchor
          aria-hidden
          className="gex-floor-tint ml-1.5 inline size-3 align-[-1px]"
        />
      )}
      <span className="ml-2 hidden text-[11px] text-muted-foreground/80 sm:inline">
        {showSector ? stock.sector : stock.name}
      </span>
      <span className="block truncate text-[11px] text-muted-foreground/70 sm:hidden">
        {stock.name}
      </span>
    </>
  );

  return (
    <tr
      onClick={(event) => {
        if ((event.target as Element).closest("a,button")) return;
        if (!href && onSelect && opensPanel(event, window.matchMedia("(min-width: 768px)").matches)) onSelect(stock.symbol);
        else { rememberBoardScroll(); router.push(href ?? `/symbol/${stock.symbol}`); }
      }}
      style={statusStyle(stock.status)}
      className={cn(
        "cursor-pointer border-b border-border/40 transition-colors last:border-0",
        "hover:bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)]",
        // Extremes get a rail of state colour on the leading edge — the row
        // equivalent of the card's top hairline, and the thing that makes them
        // findable when scrolling past sixty neutral rows.
        isExtreme &&
          "bg-[color-mix(in_oklch,var(--state)_5%,transparent)] shadow-[inset_2px_0_0_0_var(--state)]",
        // Same precedence as the card: the rarer signal takes the rail.
        floor && "gex-floor-row",
      )}
    >
      <td className="w-12 pl-1"><WatchButton symbol={stock.symbol} compact /></td>
      <td className="py-2.5 pl-2">
        <Link href={href ?? `/symbol/${stock.symbol}`} prefetch={false}
          onClick={(event) => {
            event.stopPropagation();
            if (!href && onSelect && opensPanel(event, window.matchMedia("(min-width: 768px)").matches)) {
              event.preventDefault(); onSelect(stock.symbol);
            }
          }} aria-label={label} className={cn(cellClass, "flex min-h-11 w-full min-w-0 flex-col justify-center sm:inline-flex sm:w-auto")}>
          {symbolBody}
        </Link>
      </td>

      <td className="num hidden py-2.5 text-right text-[13px] sm:table-cell">
        {formatCurrency(stock.price)}
      </td>

      <td
        className={cn(
          "num py-2.5 text-right text-[13px]",
          stock.changePercent > 0
            ? "text-up"
            : stock.changePercent < 0
              ? "text-down"
              : "text-muted-foreground",
        )}
      >
        {formatPercent(stock.changePercent)}
      </td>

      <td className="num hidden py-2.5 text-right text-[11px] whitespace-nowrap text-muted-foreground/80 lg:table-cell">
        {formatCurrency(stock.sigma1Lower)} –{" "}
        {formatCurrency(stock.sigma1Upper)}
        <span className="ml-1.5 text-muted-foreground/60">
          {formatBandWidth(stock.sigmaPercent)}
        </span>
      </td>

      <td className="hidden py-2.5 pl-6 md:table-cell">
        <SigmaRangeBar zScore={stock.zScore} status={stock.status} />
      </td>

      <td
        className={cn(
          "num py-2.5 pl-2 pr-3 text-right text-[13px] font-semibold sm:pl-5 sm:pr-4 xl:pr-0",
          stock.status === "NORMAL" ? "text-foreground/75" : "state-tint",
        )}
      >
        {formatSigma(stock.zScore)}
      </td>

      <td className="hidden py-2.5 pr-4 text-right xl:table-cell">
        <StatusBadge status={stock.status} />
      </td>
    </tr>
  );
}

function Th({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "label-xs py-2.5 align-bottom font-medium",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}
