import {
  BAND_LIMIT,
  SIGMA_EXTREME,
  bandPosition,
  isBeyondBand,
  statusStyle,
} from "@/lib/sigma";
import { formatSigma } from "@/lib/format";
import type { SigmaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const EDGES = {
  lowerExtreme: bandPosition(-SIGMA_EXTREME),
  lower1: bandPosition(-1),
  anchor: bandPosition(0),
  upper1: bandPosition(1),
  upperExtreme: bandPosition(SIGMA_EXTREME),
};

const TICKS = [
  { at: EDGES.lowerExtreme, label: "−1.5σ", strong: true },
  { at: EDGES.lower1, label: "−1σ", strong: false },
  { at: EDGES.anchor, label: "Anchor", strong: true },
  { at: EDGES.upper1, label: "+1σ", strong: false },
  { at: EDGES.upperExtreme, label: "+1.5σ", strong: true },
];

interface SigmaRangeBarProps {
  zScore: number;
  status: SigmaStatus;
  /** `detailed` adds axis labels and a floating read-out above the marker. */
  variant?: "compact" | "detailed";
  className?: string;
}

export function SigmaRangeBar({
  zScore,
  status,
  variant = "compact",
  className,
}: SigmaRangeBarProps) {
  const position = bandPosition(zScore);
  const clipped = isBeyondBand(zScore);
  const isExtreme = status === "OVERHEATED" || status === "OVERSOLD";
  const detailed = variant === "detailed";

  return (
    <div
      style={statusStyle(status)}
      className={cn("w-full", className)}
      role="img"
      aria-label={`Position within expected range: ${formatSigma(zScore)} from the anchor close, between ${BAND_LIMIT} sigma bounds.`}
    >
      <div className={cn("relative", detailed ? "h-2.5" : "h-1.5")}>
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
            key={tick.label}
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
           narrow detail panel. */
        <div className="relative mt-2 h-8">
          {TICKS.map((tick) => (
            <span
              key={tick.label}
              className={cn(
                "num absolute -translate-x-1/2 text-[10px] tracking-tight",
                tick.strong && tick.at !== EDGES.anchor ? "top-4" : "top-0",
                tick.at === EDGES.anchor
                  ? "text-foreground/70"
                  : "text-muted-foreground/70",
              )}
              style={{ left: `${tick.at}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
