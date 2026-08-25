"use client";

import {
  formatBandWidth,
  formatCurrency,
  formatPercent,
  formatSigma,
} from "@/lib/format";
import { STATUS_META, statusStyle } from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SigmaRangeBar } from "./sigma-range-bar";
import { StatusBadge } from "./status-badge";

interface StockTableProps {
  stocks: StockData[];
  onSelect: (symbol: string) => void;
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
export function StockTable({ stocks, onSelect }: StockTableProps) {
  return (
    <div className="glass overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Every symbol matching the current filter, with its price, daily
            change, ±1σ band and current position inside it.
          </caption>
          <thead>
            <tr className="border-b border-border/60">
              <Th className="pl-4">Symbol</Th>
              <Th align="right" className="hidden sm:table-cell">
                Price
              </Th>
              <Th align="right">Change</Th>
              <Th align="right" className="hidden lg:table-cell">
                ±1σ range
              </Th>
              {/* The bar is the one cell that should absorb slack as the table
                  widens, so it is the only one without a natural width. */}
              <Th className="hidden w-[26%] pl-6 md:table-cell">Band</Th>
              {/* Matches the cell's gutter exactly — the status column takes it
                  over at xl, and until then a bare header sits flush to the
                  card edge while the numbers under it are inset. */}
              <Th align="right" className="pr-4 xl:pr-0">
                σ
              </Th>
              <Th align="right" className="hidden pr-4 xl:table-cell">
                Status
              </Th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <Row key={stock.symbol} stock={stock} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  stock,
  onSelect,
}: {
  stock: StockData;
  onSelect: (symbol: string) => void;
}) {
  const isExtreme =
    stock.status === "OVERHEATED" || stock.status === "OVERSOLD";

  return (
    <tr
      onClick={() => onSelect(stock.symbol)}
      style={statusStyle(stock.status)}
      className={cn(
        "cursor-pointer border-b border-border/40 transition-colors last:border-0",
        "hover:bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)]",
        // Extremes get a rail of state colour on the leading edge — the row
        // equivalent of the card's top hairline, and the thing that makes them
        // findable when scrolling past sixty neutral rows.
        isExtreme &&
          "bg-[color-mix(in_oklch,var(--state)_5%,transparent)] shadow-[inset_2px_0_0_0_var(--state)]",
      )}
    >
      <td className="py-2.5 pl-4">
        <button
          type="button"
          onClick={(event) => {
            // The row already handles the click; without this the panel would
            // open twice and the second call would fight the first.
            event.stopPropagation();
            onSelect(stock.symbol);
          }}
          aria-label={`${stock.symbol}, ${stock.name}. ${STATUS_META[stock.status].longLabel}. Open details.`}
          className="cursor-pointer rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="num text-[13px] font-semibold">{stock.symbol}</span>
          <span className="ml-2 hidden text-[11px] text-muted-foreground/80 sm:inline">
            {stock.sector}
          </span>
          <span className="block max-w-[16rem] truncate text-[11px] text-muted-foreground/70 sm:hidden">
            {stock.name}
          </span>
        </button>
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
        {formatCurrency(stock.sigma1Lower)} – {formatCurrency(stock.sigma1Upper)}
        <span className="ml-1.5 text-muted-foreground/60">
          {formatBandWidth(stock.sigmaPercent)}
        </span>
      </td>

      <td className="hidden py-2.5 pl-6 md:table-cell">
        <SigmaRangeBar zScore={stock.zScore} status={stock.status} />
      </td>

      <td
        className={cn(
          "num py-2.5 pr-4 text-right text-[13px] font-semibold xl:pr-0",
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
