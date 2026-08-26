"use client";

import Link from "next/link";

import { formatBandWidth, formatCurrency, formatSigma } from "@/lib/format";
import { STATUS_META, statusStyle } from "@/lib/sigma";
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
  /**
   * Navigates instead of opening the panel — used by the server-rendered
   * screener pages, which have no panel to open.
   *
   * The card swaps its own tag rather than being wrapped in a link, because a
   * `<button>` inside an `<a>` is invalid HTML: the browser resolves the nesting
   * however it likes, and keyboard users get two focus stops for one card.
   */
  href?: string;
}

export function StockCard({ stock, onSelect, href }: StockCardProps) {
  const isExtreme =
    stock.status === "OVERHEATED" || stock.status === "OVERSOLD";

  const label = `${stock.symbol}, ${stock.name}. ${STATUS_META[stock.status].longLabel}. ${
    href ? "Open page." : "Open details."
  }`;

  const className = cn(
    "glass glass-interactive group block w-full cursor-pointer p-4 text-left",
    isExtreme &&
      "border-[color-mix(in_oklch,var(--state)_34%,transparent)] shadow-[0_0_0_1px_color-mix(in_oklch,var(--state)_14%,transparent),0_18px_44px_-32px_var(--state)]",
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
            <span className="truncate text-[11px] text-muted-foreground/80">
              {stock.sector}
            </span>
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

  if (href) {
    return (
      <Link
        href={href}
        style={statusStyle(stock.status)}
        aria-label={label}
        className={className}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect?.(stock.symbol)}
      style={statusStyle(stock.status)}
      aria-label={label}
      className={className}
    >
      {body}
    </button>
  );
}
