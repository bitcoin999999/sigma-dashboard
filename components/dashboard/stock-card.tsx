"use client";

import Link from "next/link";
import { opensPanel } from "@/lib/stock-navigation";
import { WatchButton } from "@/components/watchlist/watch-button";
import { Anchor } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { formatBandWidth, formatCurrency, formatSigma } from "@/lib/format";
import { findGexFloor } from "@/lib/gex-floor";
import { STATUS_COPY } from "@/lib/i18n";
import { statusStyle } from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AnimatedValue } from "./animated-value";
import { ChangePill } from "./change-pill";
import { SigmaRangeBar } from "./sigma-range-bar";
import { StatusBadge } from "./status-badge";

interface StockCardProps {
  stock: StockData;
  /** Opens the detail panel in place. Ignored when `href` is given. */
  onSelect?: (symbol: string) => void;
  /** Navigates instead of opening the panel — used by screener pages. */
  href?: string;
  /** Off inside a sector block, where the heading already said it. */
  showSector?: boolean;
  showWatch?: boolean;
}

export function StockCard({
  stock,
  onSelect,
  href,
  showSector = true,
  showWatch = true,
}: StockCardProps) {
  const { locale, pick } = useLocale();
  const isExtreme =
    stock.status === "OVERHEATED" || stock.status === "OVERSOLD";

  // Derived here rather than passed in, so the purple shows up wherever a card
  // does — the board, My Sigma, the daily digest — and not only on the screener
  // built around it. There is nothing to look up: the levels are already on the
  // snapshot this card was handed.
  const floor = findGexFloor(stock);

  const label = `${stock.symbol}, ${stock.name}. ${STATUS_COPY[locale][stock.status].longLabel}.${
    floor ? pick(" −1σ 하단에 GEX floor.", " GEX floor on the −1σ edge.") : ""
  } ${pick("상세 열기.", "Open details.")}`;

  const className = cn(
    "glass glass-interactive group block w-full cursor-pointer p-4 text-left",
    isExtreme &&
      "border-[color-mix(in_oklch,var(--state)_34%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklch,var(--state)_14%,transparent),0_18px_44px_-32px_var(--state)]",
    // Last, so it wins the border on a card that is both. The band state still
    // reads off the badge and the σ figure, which is where it belongs.
    floor && "gex-floor-card",
  );

  const body = (
    <>
      {/* Extreme readings get a hairline of state colour along the top edge. */}
      {isExtreme && (
        <span
          aria-hidden
          className="absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--state),transparent)] opacity-70"
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="num text-[15px] leading-none font-semibold tracking-tight">
              {stock.symbol}
            </span>
            {showSector && (
              <span className="truncate text-[11px] text-muted-foreground/80">
                {stock.sector}
              </span>
            )}
          </div>
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {stock.name}
          </p>
        </div>
        <StatusBadge status={stock.status} />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <AnimatedValue
          value={stock.price}
          format={formatCurrency}
          className="text-xl leading-none font-semibold tracking-tight"
        />
        <ChangePill value={stock.changePercent} />
      </div>

      <div className="mt-4">
        <SigmaRangeBar zScore={stock.zScore} status={stock.status} />
      </div>

      {/* Without this the glow is just a colour. The strike is the claim. */}
      {floor && (
        <p className="gex-floor-chip num mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium">
          <Anchor className="size-3" aria-hidden />
          GEX floor {formatCurrency(floor.strike)}
        </p>
      )}

      <div className="mt-3.5 flex items-center justify-between gap-2">
        <span className="num min-w-0 truncate text-[11px] text-muted-foreground/80">
          {formatCurrency(stock.sigma1Lower)} –{" "}
          {formatCurrency(stock.sigma1Upper)}
          <span className="ml-1.5 text-muted-foreground/60">
            {formatBandWidth(stock.sigmaPercent)}
          </span>
        </span>
        <span
          className={cn(
            "num text-xs font-semibold",
            stock.status === "NORMAL" ? "text-foreground/75" : "state-tint",
          )}
        >
          {formatSigma(stock.zScore)}
        </span>
      </div>
    </>
  );

  return (
    <div className="relative min-w-0">
      <Link
        href={href ?? `/symbol/${stock.symbol}`}
        prefetch={false}
        onClick={(event) => {
          if (!href && onSelect && opensPanel(event, window.matchMedia("(min-width: 768px)").matches)) {
            event.preventDefault(); onSelect(stock.symbol);
          }
        }}
        style={statusStyle(stock.status)}
        aria-label={label}
        className={cn(className, showWatch && "pr-16")}
      >{body}</Link>
      {showWatch && <div className="absolute right-2 top-2"><WatchButton symbol={stock.symbol} compact /></div>}
    </div>
  );
}
