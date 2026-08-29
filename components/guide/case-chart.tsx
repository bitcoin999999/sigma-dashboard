import { CASE } from "@/lib/guide";
import { cn } from "@/lib/utils";

const VIEW = { width: 640, height: 300 };
const PAD = { top: 20, right: 100, bottom: 30, left: 8 };

const PLOT_WIDTH = VIEW.width - PAD.left - PAD.right;
const PLOT_HEIGHT = VIEW.height - PAD.top - PAD.bottom;

const SLOT = PLOT_WIDTH / CASE.sessions.length;
const BODY_WIDTH = 26;

/**
 * The price window, padded off the extremes it actually has to hold.
 *
 * The anchor is one of them even though price never went near it: the week
 * opened six percent below where the band was struck, and a chart cropped to
 * the candles alone would hide the fact that the whole week traded in the
 * lower half of its own range.
 */
const LOW = Math.min(
  ...CASE.sessions.map((session) => session.low),
  CASE.gex.strike,
  CASE.sigma1Lower,
);
const HIGH = Math.max(
  ...CASE.sessions.map((session) => session.high),
  CASE.anchor,
);
const PADDING = (HIGH - LOW) * 0.03;
const MIN = LOW - PADDING;
const MAX = HIGH + PADDING;

function y(price: number): number {
  return PAD.top + ((MAX - price) / (MAX - MIN)) * PLOT_HEIGHT;
}

function x(index: number): number {
  return PAD.left + SLOT * (index + 0.5);
}

const LABEL_X = PAD.left + PLOT_WIDTH + 10;

const price = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * The case study, drawn.
 *
 * Hand-rolled SVG rather than the charting library the board uses: this is one
 * fixed figure of five candles and three reference lines, and every colour has
 * to come off the same custom properties the live board reads so the −1σ edge
 * and the gamma floor are the blue and the purple a reader already knows.
 */
export function CaseChart({ className }: { className?: string }) {
  return (
    /* Scrolls rather than shrinks on a phone. Every label is drawn in viewBox
       units, so letting the figure take a 375px column would render the prices
       at about five pixels. */
    <div className={cn("-mx-1 overflow-x-auto px-1", className)}>
      <svg
        viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
        className="h-auto w-full min-w-[34rem]"
        role="img"
        aria-label={`${CASE.symbol} daily candles for ${CASE.bandWindow}. Monday traded down to $1,416.56, below both the −1σ edge at $${price.format(CASE.sigma1Lower)} and the gamma strike at $${price.format(CASE.gex.strike)}, and closed back above them at $1,493.12. Tuesday reached $1,564.99.`}
      >
        {/* Anchor: where the band was struck, far above everything that followed. */}
        <line
          x1={PAD.left}
          x2={PAD.left + PLOT_WIDTH}
          y1={y(CASE.anchor)}
          y2={y(CASE.anchor)}
          stroke="var(--muted-foreground)"
          strokeWidth={1}
          strokeDasharray="2 4"
          opacity={0.6}
        />
        <text
          x={LABEL_X}
          y={y(CASE.anchor) + 4}
          fontSize={11}
          fill="var(--muted-foreground)"
        >
          Anchor ${price.format(CASE.anchor)}
        </text>

        {/* The two levels the example is about. They are $2.32 apart, so on this
            scale they render as one line — which is the point being made. */}
        <line
          x1={PAD.left}
          x2={PAD.left + PLOT_WIDTH}
          y1={y(CASE.sigma1Lower)}
          y2={y(CASE.sigma1Lower)}
          stroke="var(--sigma-lower)"
          strokeWidth={1.4}
          strokeDasharray="5 3"
        />
        <line
          x1={PAD.left}
          x2={PAD.left + PLOT_WIDTH}
          y1={y(CASE.gex.strike)}
          y2={y(CASE.gex.strike)}
          stroke="var(--gex-floor)"
          strokeWidth={1.4}
        />
        <text
          x={LABEL_X}
          y={y(CASE.sigma1Lower) - 5}
          fontSize={11}
          fill="var(--sigma-lower)"
        >
          −1σ ${price.format(CASE.sigma1Lower)}
        </text>
        <text
          x={LABEL_X}
          y={y(CASE.gex.strike) + 12}
          fontSize={11}
          fill="var(--gex-floor)"
        >
          GEX ${price.format(CASE.gex.strike)}
        </text>

        {CASE.sessions.map((session, index) => {
          const up = session.close >= session.open;
          const tone = up ? "var(--up)" : "var(--down)";
          const top = y(Math.max(session.open, session.close));
          const bottom = y(Math.min(session.open, session.close));

          return (
            <g key={session.date}>
              <line
                x1={x(index)}
                x2={x(index)}
                y1={y(session.high)}
                y2={y(session.low)}
                stroke={tone}
                strokeWidth={1.4}
              />
              <rect
                x={x(index) - BODY_WIDTH / 2}
                y={top}
                width={BODY_WIDTH}
                height={Math.max(bottom - top, 2)}
                rx={1.5}
                fill={tone}
                opacity={up ? 0.9 : 0.75}
              />
              <text
                x={x(index)}
                y={VIEW.height - PAD.bottom + 17}
                fontSize={11}
                textAnchor="middle"
                fill="var(--muted-foreground)"
              >
                {session.day}
              </text>
            </g>
          );
        })}

        {/* Monday's low: the only print of the week under both levels. */}
        <circle
          cx={x(0)}
          cy={y(CASE.sessions[0].low)}
          r={3}
          fill="var(--down)"
        />
        <text
          x={x(0) + 20}
          y={y(CASE.sessions[0].low) + 4}
          fontSize={11}
          fill="var(--down)"
        >
          ${price.format(CASE.sessions[0].low)}
        </text>

        {/* Tuesday's high, 10.5% above it. */}
        <circle
          cx={x(1)}
          cy={y(CASE.sessions[1].high)}
          r={3}
          fill="var(--up)"
        />
        <text
          x={x(1)}
          y={y(CASE.sessions[1].high) - 9}
          fontSize={11}
          textAnchor="middle"
          fill="var(--up)"
        >
          ${price.format(CASE.sessions[1].high)}
        </text>
      </svg>
    </div>
  );
}
