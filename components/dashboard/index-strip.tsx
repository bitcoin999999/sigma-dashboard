"use client";

import { ChangePill } from "@/components/dashboard/change-pill";
import { SigmaRangeBar } from "@/components/dashboard/sigma-range-bar";
import { formatCurrency, formatSigma } from "@/lib/format";
import { STATUS_META, statusStyle } from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The four tickers that answer "is it me or is it the market?" before any
 * single name means anything.
 *
 * Order runs by how much of the week's move is a growth story: the Nasdaq 100
 * first, the S&P next, then the Dow as the old-economy read, and semis last as
 * the highest-beta of the four. Read left to right, a divergence tells you
 * which end of the market it belongs to.
 *
 * The lookup is by symbol against the same universe the rest of the page reads,
 * so no separate data path exists to drift out of sync.
 */
const INDEX_SYMBOLS = ["QQQ", "SPY", "DIA", "SOXX"] as const;

const INDEX_CAPTION: Record<string, string> = {
  QQQ: "Nasdaq 100",
  SPY: "S&P 500",
  DIA: "Dow 30",
  SOXX: "Semiconductors",
};

interface IndexStripProps {
  stocks: StockData[];
  onSelect: (symbol: string) => void;
  className?: string;
}

export function IndexStrip({ stocks, onSelect, className }: IndexStripProps) {
  const indices = INDEX_SYMBOLS.map((symbol) =>
    stocks.find((stock) => stock.symbol === symbol),
  ).filter((stock): stock is StockData => stock !== undefined);

  // Nothing to anchor the page on if the publisher dropped all three. Better an
  // absent strip than three empty frames implying the market is flat.
  if (indices.length === 0) return null;

  return (
    // Two-up before four-up, never three: at three columns the fourth card
    // drops to a row of its own and reads as an afterthought rather than a
    // peer of the other three.
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {indices.map((stock) => (
        <IndexCard key={stock.symbol} stock={stock} onSelect={onSelect} />
      ))}
    </div>
  );
}

function IndexCard({
  stock,
  onSelect,
}: {
  stock: StockData;
  onSelect: (symbol: string) => void;
}) {
  const meta = STATUS_META[stock.status];
  const isExtreme =
    stock.status === "OVERHEATED" || stock.status === "OVERSOLD";

  return (
    <button
      type="button"
      onClick={() => onSelect(stock.symbol)}
      style={statusStyle(stock.status)}
      aria-label={`${stock.symbol}, ${formatSigma(stock.zScore)}, ${meta.longLabel}`}
      className={cn(
        "glass glass-interactive group w-full cursor-pointer p-4 text-left",
        isExtreme &&
          "border-[color-mix(in_oklch,var(--state)_34%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklch,var(--state)_14%,transparent),0_18px_44px_-32px_var(--state)]",
      )}
    >
      {isExtreme && (
        <span
          aria-hidden
          className="absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--state),transparent)] opacity-70"
        />
      )}

      <div className="flex items-baseline gap-2">
        <span className="num text-[15px] font-semibold tracking-[-0.01em]">
          {stock.symbol}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {INDEX_CAPTION[stock.symbol] ?? stock.name}
        </span>
        <ChangePill
          value={stock.changePercent}
          className="ml-auto"
          showIcon={false}
        />
      </div>

      {/* The σ reading is the headline here, not the price. The whole point of
          the strip is how far the index is through its own weekly range — the
          dollar figure below it is context for that number, not the other way
          round. */}
      <div className="mt-3 flex items-end justify-between gap-3">
        <span
          className={cn(
            "num text-[1.75rem] leading-none font-semibold tracking-tight",
            stock.status === "NORMAL" ? "text-foreground/85" : "state-tint",
          )}
        >
          {formatSigma(stock.zScore, 2)}
        </span>
        <span className="num pb-0.5 text-xs text-muted-foreground">
          {formatCurrency(stock.price)}
        </span>
      </div>

      <SigmaRangeBar
        zScore={stock.zScore}
        status={stock.status}
        className="mt-3"
      />

      {/* Same pairing the watchlist cards use — the ±1σ prices on the left, the
          verdict on the right. Without the range the bar above is a position
          with no scale: "0.00σ" says the index is at its anchor but not how
          wide the week it is anchored in actually is. */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="num text-[11px] text-muted-foreground/80">
          {formatCurrency(stock.sigma1Lower)} – {formatCurrency(stock.sigma1Upper)}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {meta.longLabel}
        </span>
      </div>
    </button>
  );
}
