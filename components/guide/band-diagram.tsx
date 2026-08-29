import { SIGMA_EXTREME, bandPosition } from "@/lib/sigma";
import { cn } from "@/lib/utils";

const EDGE = {
  lowerExtreme: bandPosition(-SIGMA_EXTREME),
  lower1: bandPosition(-1),
  anchor: bandPosition(0),
  upper1: bandPosition(1),
  upperExtreme: bandPosition(SIGMA_EXTREME),
};

const TICKS = [
  { at: EDGE.lowerExtreme, label: "−1.5σ" },
  { at: EDGE.lower1, label: "−1σ" },
  { at: EDGE.anchor, label: "Anchor" },
  { at: EDGE.upper1, label: "+1σ" },
  { at: EDGE.upperExtreme, label: "+1.5σ" },
];

/**
 * The scale every reading on the board is quoted against.
 *
 * Built from `bandPosition` and the same custom properties the live range bar
 * uses, so the picture a reader learns from here is the picture they meet on
 * a card — a legend drawn with its own hardcoded colours would drift the first
 * time the palette moved.
 */
export function BandDiagram({ className }: { className?: string }) {
  return (
    <figure className={cn("w-full", className)}>
      {/* The span the whole page is about, called out above the track. */}
      <div className="relative h-9">
        <div
          className="absolute top-4 flex flex-col items-center"
          style={{
            left: `${EDGE.lower1}%`,
            width: `${EDGE.upper1 - EDGE.lower1}%`,
          }}
        >
          <span className="num text-[11px] whitespace-nowrap text-muted-foreground">
            ≈ 68% of expected outcomes
          </span>
          <span className="mt-1 h-1.5 w-full rounded-t-sm border-x border-t border-border" />
        </div>
      </div>

      <div
        className="relative h-3"
        role="img"
        aria-label="The expected-range scale, running from below −1.5 sigma through the anchor close to above +1.5 sigma."
      >
        <div className="absolute inset-0 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)]">
          <div
            className="absolute inset-y-0 left-0 bg-[color-mix(in_oklch,var(--sigma-cold)_26%,transparent)]"
            style={{ width: `${EDGE.lowerExtreme}%` }}
          />
          <div
            className="absolute inset-y-0 bg-[color-mix(in_oklch,var(--sigma-lower)_20%,transparent)]"
            style={{
              left: `${EDGE.lowerExtreme}%`,
              width: `${EDGE.lower1 - EDGE.lowerExtreme}%`,
            }}
          />
          <div
            className="absolute inset-y-0 bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]"
            style={{
              left: `${EDGE.lower1}%`,
              width: `${EDGE.upper1 - EDGE.lower1}%`,
            }}
          />
          <div
            className="absolute inset-y-0 bg-[color-mix(in_oklch,var(--sigma-upper)_20%,transparent)]"
            style={{
              left: `${EDGE.upper1}%`,
              width: `${EDGE.upperExtreme - EDGE.upper1}%`,
            }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-[color-mix(in_oklch,var(--sigma-hot)_26%,transparent)]"
            style={{ left: `${EDGE.upperExtreme}%` }}
          />
        </div>

        {TICKS.map((tick) => (
          <span
            key={tick.label}
            aria-hidden
            className="absolute -top-1 -bottom-1 w-px -translate-x-1/2 rounded-full bg-[color-mix(in_oklch,var(--foreground)_28%,transparent)]"
            style={{ left: `${tick.at}%` }}
          />
        ))}
      </div>

      <div className="relative mt-2.5 h-4">
        {TICKS.map((tick) => (
          <span
            key={tick.label}
            className="num absolute -translate-x-1/2 text-[11px] text-muted-foreground"
            style={{ left: `${tick.at}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>

      <figcaption className="mt-4 flex justify-between gap-4 text-[11px] leading-relaxed text-muted-foreground">
        <span className="max-w-[13rem] text-left">
          Further down than the week was priced for
        </span>
        <span className="hidden max-w-[13rem] text-center sm:block">
          Inside the range the options market paid for
        </span>
        <span className="max-w-[13rem] text-right">
          Further up than the week was priced for
        </span>
      </figcaption>
    </figure>
  );
}
