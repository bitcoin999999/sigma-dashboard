"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

import { ChangePill } from "@/components/dashboard/change-pill";
import { PriceChart } from "@/components/dashboard/price-chart";
import { SigmaRangeBar } from "@/components/dashboard/sigma-range-bar";
import { useLocale } from "@/components/locale-provider";
import { formatBandWidth, formatCurrency, formatSigma } from "@/lib/format";
import { STATUS_COPY } from "@/lib/i18n";
import { statusStyle } from "@/lib/sigma";
import { opensPanel } from "@/lib/stock-navigation";
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

/**
 * The same destination and the same desktop-only panel interception a watchlist
 * card uses: an index is a symbol like any other, and clicking one should land
 * where clicking NVDA lands rather than in a strip-specific behaviour.
 */
function indexLink(
  stock: StockData,
  onSelect: (symbol: string) => void,
  label: string,
) {
  return {
    href: `/symbol/${stock.symbol}`,
    prefetch: false as const,
    style: statusStyle(stock.status),
    "aria-label": label,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (opensPanel(event, window.matchMedia("(min-width: 768px)").matches)) {
        event.preventDefault();
        onSelect(stock.symbol);
      }
    },
  };
}

export function IndexStrip({ stocks, onSelect, className }: IndexStripProps) {
  const indices = INDEX_SYMBOLS.map((symbol) =>
    stocks.find((stock) => stock.symbol === symbol),
  ).filter((stock): stock is StockData => stock !== undefined);

  // Nothing to anchor the page on if the publisher dropped all three. Better an
  // absent strip than three empty frames implying the market is flat.
  if (indices.length === 0) return null;

  return (
    <>
      {/* On a phone the four cards stacked to a full screen before a single
          name appeared. Four indices are a comparison, and a comparison wants
          one number column the eye can run down — not four framed panels it
          has to re-orient inside of. Same data, one surface, no sparkline. */}
      <ul
        className={cn(
          "glass divide-y divide-[var(--hairline)] overflow-hidden sm:hidden",
          className,
        )}
      >
        {indices.map((stock) => (
          <li key={stock.symbol}>
            <IndexRow stock={stock} onSelect={onSelect} />
          </li>
        ))}
      </ul>

      {/* Two-up before four-up, never three: at three columns the fourth card
          drops to a row of its own and reads as an afterthought rather than a
          peer of the other three. */}
      <div
        className={cn(
          "hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4",
          className,
        )}
      >
        {indices.map((stock) => (
          <IndexCard key={stock.symbol} stock={stock} onSelect={onSelect} />
        ))}
      </div>
    </>
  );
}

function IndexRow({
  stock,
  onSelect,
}: {
  stock: StockData;
  onSelect: (symbol: string) => void;
}) {
  const { locale } = useLocale();
  const meta = STATUS_COPY[locale][stock.status];

  return (
    <Link
      {...indexLink(
        stock,
        onSelect,
        `${stock.symbol}, ${formatSigma(stock.zScore)}, ${meta.longLabel}`,
      )}
      className="flex min-h-[4.25rem] w-full cursor-pointer items-center gap-3 px-4 py-3 text-left active:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="num text-[15px] font-semibold tracking-[-0.01em]">
            {stock.symbol}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {INDEX_CAPTION[stock.symbol] ?? stock.name}
          </span>
        </div>
        {/* The bar carries the band position the sparkline used to imply, at a
            twentieth of the height. */}
        <SigmaRangeBar
          zScore={stock.zScore}
          status={stock.status}
          className="mt-2"
        />
        <p className="num mt-1.5 truncate text-[11px] text-muted-foreground/80">
          {formatCurrency(stock.sigma1Lower)} – {formatCurrency(stock.sigma1Upper)}
          <span className="ml-1.5 text-muted-foreground/60">
            {formatBandWidth(stock.sigmaPercent)}
          </span>
        </p>
      </div>

      {/* One right edge for all four rows: σ, then price, then the day. */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "num text-lg leading-none font-semibold tracking-tight",
            stock.status === "NORMAL" ? "text-foreground/85" : "state-tint",
          )}
        >
          {formatSigma(stock.zScore, 2)}
        </span>
        <span className="num text-xs text-muted-foreground">
          {formatCurrency(stock.price)}
        </span>
        <ChangePill value={stock.changePercent} showIcon={false} />
      </div>
    </Link>
  );
}

function IndexCard({
  stock,
  onSelect,
}: {
  stock: StockData;
  onSelect: (symbol: string) => void;
}) {
  const { locale } = useLocale();
  const meta = STATUS_COPY[locale][stock.status];
  const isExtreme =
    stock.status === "OVERHEATED" || stock.status === "OVERSOLD";

  return (
    <Link
      {...indexLink(
        stock,
        onSelect,
        `${stock.symbol}, ${formatSigma(stock.zScore)}, ${meta.longLabel}`,
      )}
      className={cn(
        "glass glass-interactive group block w-full cursor-pointer p-4 text-left",
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

      {/* The chart sits between the σ figure and the band range on purpose: the
          two numbers around it are both weekly, and the session line is what
          says whether today is what put the index there. */}
      <div className="mt-2 -mr-1">
        <PriceChart stock={stock} compact />
      </div>

      <SigmaRangeBar
        zScore={stock.zScore}
        status={stock.status}
        className="mt-2"
      />

      {/* Same pairing the watchlist cards use — the ±1σ prices on the left, the
          verdict on the right. Without the range the bar above is a position
          with no scale: "0.00σ" says the index is at its anchor but not how
          wide the week it is anchored in actually is. */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="num min-w-0 truncate text-[11px] text-muted-foreground/80">
          {formatCurrency(stock.sigma1Lower)} – {formatCurrency(stock.sigma1Upper)}
          <span className="ml-1.5 text-muted-foreground/60">
            {formatBandWidth(stock.sigmaPercent)}
          </span>
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {meta.longLabel}
        </span>
      </div>
    </Link>
  );
}
