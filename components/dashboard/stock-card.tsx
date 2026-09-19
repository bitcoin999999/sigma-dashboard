"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { opensPanel } from "@/lib/stock-navigation";
import { WatchButton } from "@/components/watchlist/watch-button";
import { Anchor } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { formatBandWidth, formatCurrency, formatSigma } from "@/lib/format";
import { findGexFloor, findGexSupport } from "@/lib/gex-floor";
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
  /**
   * Also name the largest options support when there is no −1σ confluence.
   *
   * Off by default. On the board the purple is a rarity worth noticing, and a
   * chip on the two dozen cards that merely have a support strike would bury
   * it. The daily card turns this on because there the strike is the reason
   * the symbol is on the page at all.
   */
  showSupport?: boolean;
}

export function StockCard({
  stock,
  onSelect,
  href,
  showSector = true,
  showWatch = true,
  showSupport = false,
}: StockCardProps) {
  const { locale, pick } = useLocale();
  const isExtreme =
    stock.status === "OVERHEATED" || stock.status === "OVERSOLD";

  // Derived here rather than passed in, so the purple shows up wherever a card
  // does — the board, My Sigma, the daily digest — and not only on the screener
  // built around it. There is nothing to look up: the levels are already on the
  // snapshot this card was handed.
  const floor = findGexFloor(stock);
  const support = !floor && showSupport ? findGexSupport(stock) : null;

  const label = `${stock.symbol}, ${stock.name}. ${STATUS_COPY[locale][stock.status].longLabel}.${
    floor ? pick(" −1σ 하단에 GEX floor.", " GEX floor on the −1σ edge.") : ""
  }${
    support
      ? pick(
          ` ${formatCurrency(support.strike)}에 GEX 지지.`,
          ` GEX support at ${formatCurrency(support.strike)}.`,
        )
      : ""
  } ${pick("상세 열기.", "Open details.")}`;

  // Both variants want the same destination and the same desktop-only panel
  // interception, so the link plumbing is written once and spread into each.
  const link = {
    href: href ?? `/symbol/${stock.symbol}`,
    prefetch: false as const,
    style: statusStyle(stock.status),
    "aria-label": label,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        !href &&
        onSelect &&
        opensPanel(event, window.matchMedia("(min-width: 768px)").matches)
      ) {
        event.preventDefault();
        onSelect(stock.symbol);
      }
    },
  };

  // Tightened from p-4 and a 4-unit rhythm. Nothing was removed — the card
  // carries the same six things — but on a 1600px board it was spending more
  // height on the air between them than on the figures, and the four-across
  // grid made each one wider than anything in it needed.
  const className = cn(
    "glass glass-interactive group block w-full cursor-pointer p-3.5 text-left",
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
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {stock.name}
          </p>
        </div>
        <StatusBadge status={stock.status} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <AnimatedValue
          value={stock.price}
          format={formatCurrency}
          className="text-lg leading-none font-semibold tracking-tight"
        />
        <ChangePill value={stock.changePercent} />
      </div>

      <div className="mt-3">
        <SigmaRangeBar zScore={stock.zScore} status={stock.status} />
      </div>

      {/* Without this the glow is just a colour. The strike is the claim. */}
      {floor && (
        <p className="gex-floor-chip num mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
          <Anchor className="size-3" aria-hidden />
          GEX floor {formatCurrency(floor.strike)}
        </p>
      )}

      {support && (
        <p className="gex-support-chip num mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium">
          <Anchor className="size-3" aria-hidden />
          GEX {formatCurrency(support.strike)}
          <span className="opacity-70">· {Math.round(support.share)}%</span>
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
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
      {/* Phone: a row in a list. The card spends 160px on framing and vertical
          rhythm that only pays off when several sit side by side — stacked one
          per line it is 12,000px of scrolling for 77 names. The row keeps the
          four things the board is read for (name, band position, price, σ) and
          drops the padding around them. */}
      <Link
        {...link}
        className={cn(
          "flex min-h-[4.5rem] w-full cursor-pointer items-center gap-3 px-4 py-3 text-left active:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:hidden",
          showWatch && "pr-12",
        )}
      >
        {/* One column, not two: the price belongs on the symbol's line and the
            day's move on the σ line, so both edges of the row line up and the
            eye reads across instead of pairing a block against a block. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="num text-[15px] leading-none font-semibold tracking-tight">
              {stock.symbol}
            </span>
            <span className="truncate text-[11px] text-muted-foreground/80">
              {stock.name}
            </span>
            <span className="num ml-auto shrink-0 pl-2 text-[15px] leading-none font-semibold tracking-tight">
              {formatCurrency(stock.price)}
            </span>
          </div>

          <SigmaRangeBar
            zScore={stock.zScore}
            status={stock.status}
            className="mt-2.5"
          />

          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                "num shrink-0 text-xs leading-none font-semibold",
                stock.status === "NORMAL" ? "text-foreground/75" : "state-tint",
              )}
            >
              {formatSigma(stock.zScore)}
            </span>
            <StatusBadge status={stock.status} />
            {(floor || support) && (
              <span
                className={cn(
                  "num inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  floor ? "gex-floor-chip" : "gex-support-chip",
                )}
              >
                <Anchor className="size-2.5" aria-hidden />
                {formatCurrency((floor ?? support)!.strike)}
              </span>
            )}
            <ChangePill
              value={stock.changePercent}
              showIcon={false}
              className="ml-auto shrink-0"
            />
          </div>
        </div>
      </Link>

      <Link
        {...link}
        className={cn(className, "hidden sm:block", showWatch && "pr-16")}
      >
        {body}
      </Link>

      {showWatch && (
        <div className="absolute top-1/2 right-1 -translate-y-1/2 sm:top-2 sm:right-2 sm:translate-y-0">
          <WatchButton symbol={stock.symbol} compact />
        </div>
      )}
    </div>
  );
}
