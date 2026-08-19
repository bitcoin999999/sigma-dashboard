"use client";

import * as React from "react";

import {
  BAND_LIMIT,
  SIGMA_EXTREME,
  bandPosition,
  isBeyondBand,
  statusStyle,
} from "@/lib/sigma";
import { formatCurrency, formatSigma } from "@/lib/format";
import type { SigmaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const EDGES = {
  lowerExtreme: bandPosition(-SIGMA_EXTREME),
  lower1: bandPosition(-1),
  anchor: bandPosition(0),
  upper1: bandPosition(1),
  upperExtreme: bandPosition(SIGMA_EXTREME),
};

type TickKey = keyof typeof EDGES;

const TICKS: { key: TickKey; at: number; label: string; strong: boolean }[] = [
  { key: "lowerExtreme", at: EDGES.lowerExtreme, label: "−1.5σ", strong: true },
  { key: "lower1", at: EDGES.lower1, label: "−1σ", strong: false },
  { key: "anchor", at: EDGES.anchor, label: "Anchor", strong: true },
  { key: "upper1", at: EDGES.upper1, label: "+1σ", strong: false },
  { key: "upperExtreme", at: EDGES.upperExtreme, label: "+1.5σ", strong: true },
];

interface SigmaRangeBarProps {
  zScore: number;
  status: SigmaStatus;
  /** `detailed` adds axis labels and a floating read-out above the marker. */
  variant?: "compact" | "detailed";
  /**
   * What each tick is worth in money. Supplying it turns the `detailed` axis
   * labels into hit targets that trade their name for their price on hover or
   * tap; without it they stay plain text.
   */
  prices?: Record<TickKey, number>;
  className?: string;
}

export function SigmaRangeBar({
  zScore,
  status,
  variant = "compact",
  prices,
  className,
}: SigmaRangeBarProps) {
  const position = bandPosition(zScore);
  const clipped = isBeyondBand(zScore);
  const isExtreme = status === "OVERHEATED" || status === "OVERSOLD";
  const detailed = variant === "detailed";

  // Hover cannot carry this on a phone, and neither can `:focus` — mobile
  // Safari does not focus a button on tap, so the price vanished the moment
  // the finger lifted. A tap latches it instead, and a second tap puts the
  // name back. Ticks latch independently on purpose: reading the band means
  // comparing −1σ against +1σ, and one shared slot would only ever show one
  // of them. The two rows are far enough apart that the numbers never meet.
  const [latched, setLatched] = React.useState<ReadonlySet<TickKey>>(
    () => new Set(),
  );
  const toggle = (key: TickKey) =>
    setLatched((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div style={statusStyle(status)} className={cn("w-full", className)}>
      {/* The graphic is the track alone. The axis below it is text, and in the
          detailed variant it is focusable — neither can live inside role="img",
          whose subtree a screen reader collapses into the label. */}
      <div
        className={cn("relative", detailed ? "h-2.5" : "h-1.5")}
        role="img"
        aria-label={`Position within expected range: ${formatSigma(zScore)} from the anchor close, between ${BAND_LIMIT} sigma bounds.`}
      >
        {/* Track: neutral outside, faintly lit inside the ±1σ core. */}
        <div className="absolute inset-0 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]">
          <div
            className="absolute inset-y-0 bg-[color-mix(in_oklch,var(--sigma-hot)_26%,transparent)]"
            style={{ left: `${EDGES.upperExtreme}%`, right: 0 }}
          />
          <div
            className="absolute inset-y-0 bg-[color-mix(in_oklch,var(--sigma-upper)_20%,transparent)]"
            style={{ left: `${EDGES.upper1}%`, width: `${EDGES.upperExtreme - EDGES.upper1}%` }}
          />
          <div
            className="absolute inset-y-0 bg-[color-mix(in_oklch,var(--sigma-cold)_26%,transparent)]"
            style={{ left: 0, width: `${EDGES.lowerExtreme}%` }}
          />
          <div
            className="absolute inset-y-0 bg-[color-mix(in_oklch,var(--sigma-lower)_20%,transparent)]"
            style={{ left: `${EDGES.lowerExtreme}%`, width: `${EDGES.lower1 - EDGES.lowerExtreme}%` }}
          />
          <div
            className="absolute inset-y-0 bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]"
            style={{ left: `${EDGES.lower1}%`, width: `${EDGES.upper1 - EDGES.lower1}%` }}
          />
        </div>

        {/* Guide rails. */}
        {TICKS.map((tick) => (
          <span
            key={tick.key}
            aria-hidden
            className={cn(
              "absolute -translate-x-1/2 rounded-full",
              detailed ? "-top-1 -bottom-1" : "-top-0.5 -bottom-0.5",
              tick.at === EDGES.anchor ? "w-px" : "w-px",
              tick.at === EDGES.anchor
                ? "bg-[color-mix(in_oklch,var(--foreground)_45%,transparent)]"
                : tick.strong
                  ? "bg-[color-mix(in_oklch,var(--foreground)_26%,transparent)]"
                  : "bg-[color-mix(in_oklch,var(--foreground)_16%,transparent)]",
            )}
            style={{ left: `${tick.at}%` }}
          />
        ))}

        {/* Current price. */}
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--state)] transition-[left] duration-500 ease-out",
            detailed ? "size-3.5" : "size-2.5",
            isExtreme
              ? "state-glow ring-2 ring-background"
              : "ring-2 ring-background shadow-[0_0_10px_-1px_var(--state)]",
            clipped && "rounded-none [clip-path:polygon(0_0,100%_50%,0_100%)]",
          )}
          style={{ left: `${position}%` }}
        />
      </div>

      {detailed && (
        /* Two rows: ±1.5σ sits below ±1σ so the labels never collide in the
           narrow detail panel. That stagger is also what lets a label widen
           into a price on hover without running into its neighbour. */
        <div className="relative mt-2 h-8">
          {TICKS.map((tick) => {
            const placement = cn(
              "num absolute -translate-x-1/2 text-[10px] tracking-tight",
              tick.strong && tick.key !== "anchor" ? "top-4" : "top-0",
              tick.key === "anchor"
                ? "text-foreground/70"
                : "text-muted-foreground/70",
            );
            const price = prices?.[tick.key];

            if (price === undefined) {
              return (
                <span
                  key={tick.key}
                  className={placement}
                  style={{ left: `${tick.at}%` }}
                >
                  {tick.label}
                </span>
              );
            }

            const held = latched.has(tick.key);

            return (
              <button
                key={tick.key}
                type="button"
                // Reading a level off the bar meant doing the arithmetic against
                // the table further down. The name and the number occupy one
                // grid cell so the swap costs no layout and shifts nothing.
                //
                // `px-2 py-1 -my-1` widens the hit area for a fingertip; the
                // padding cancels against the centring transform horizontally
                // and against the negative margin vertically, so the text lands
                // exactly where the plain label did.
                className={cn(
                  placement,
                  "group grid cursor-pointer justify-items-center rounded-sm px-2 py-1 -my-1",
                  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                )}
                style={{ left: `${tick.at}%` }}
                onClick={() => toggle(tick.key)}
                aria-pressed={held}
                aria-label={`${tick.label}: ${formatCurrency(price)}`}
              >
                {/* Each state picks exactly one opacity utility rather than
                    layering `opacity-100` over `opacity-0`. Two utilities from
                    the same group have equal specificity, so which one won
                    would come down to their order in the sheet. */}
                <span
                  aria-hidden
                  className={cn(
                    "[grid-area:1/1] transition-opacity duration-150",
                    held ? "opacity-0" : "group-hover:opacity-0 group-focus:opacity-0",
                  )}
                >
                  {tick.label}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "[grid-area:1/1] whitespace-nowrap text-foreground transition-opacity duration-150",
                    held
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100 group-focus:opacity-100",
                  )}
                >
                  {formatCurrency(price)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
