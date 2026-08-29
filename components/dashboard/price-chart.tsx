"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  type XAxisTickContentProps,
} from "recharts";

import { formatCurrency, formatDay } from "@/lib/format";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Time labels on the intraday axis. Missing bars simply drop their tick. */
const SESSION_TICKS = ["09:30", "11:00", "12:30", "14:00", "16:00"];
/** The same axis at card width, where five labels collide. */
const SESSION_TICKS_COMPACT = ["09:30", "12:30", "16:00"];

/**
 * The line's hue tracks the session's direction, not its band status.
 *
 * These are two different questions — "did it go up today" and "is it outside
 * its weekly range" — and the rest of the card already answers the second one
 * (σ figure, range bar, border tint). Reusing `--state` here spent the chart's
 * only colour channel restating that, so a green day inside a hot band drew red.
 */
function trendColor(changePercent: number): string {
  return changePercent < 0 ? "var(--down)" : "var(--up)";
}

/**
 * Price ticks are the reason the axis is here, so they must not wrap: a
 * four-figure index at two decimals is wider than the gutter allows.
 */
function axisPrice(value: number): string {
  const digits = Math.abs(value) >= 1000 ? 0 : Math.abs(value) >= 100 ? 1 : 2;
  return `$${value.toFixed(digits)}`;
}

/**
 * Recharts centres every label on its own tick, so the first one on a
 * zero-margin axis loses its left half to the clip and `09:30` reads `:30`.
 * Anchoring the two end labels inward buys the room back without spending plot
 * width on a margin.
 */
function edgeTick(fontSize: number, format?: (value: string) => string) {
  return function Tick({
    x,
    y,
    index,
    visibleTicksCount,
    payload,
  }: XAxisTickContentProps) {
    const value = String(payload.value);
    return (
      <text
        x={x}
        y={y}
        dy={10}
        textAnchor={
          index === 0
            ? "start"
            : index === visibleTicksCount - 1
              ? "end"
              : "middle"
        }
        fontSize={fontSize}
        fill="var(--muted-foreground)"
      >
        {format ? format(value) : value}
      </text>
    );
  };
}

/**
 * SVG def ids are document-global. Four benchmark cards all declaring
 * `id="sigma-area"` would every one of them resolve to the first card's
 * gradient, and so wear the first card's colour.
 *
 * Keyed off the symbol rather than `useId()` because a symbol can legitimately
 * appear twice at once (a benchmark card with the detail panel open over it),
 * and both instances want the same gradient anyway.
 */
function gradientKey(symbol: string, compact: boolean, kind: string): string {
  return `price-${kind}-${symbol}-${compact ? "c" : "w"}`;
}

export function PriceChart({
  stock,
  compact = false,
}: {
  stock: StockData;
  compact?: boolean;
}) {
  return stock.intraday ? (
    <SessionChart stock={stock} compact={compact} />
  ) : (
    <BandPathChart stock={stock} compact={compact} />
  );
}

/** A band level the session chart has to account for, drawn or not. */
interface BandLevel {
  key: string;
  label: string;
  value: number;
  stroke: string;
  strokeOpacity: number;
  dash: string;
  position:
    | "insideTopLeft"
    | "insideBottomLeft"
    | "insideTopRight"
    | "insideBottomRight";
}

/**
 * One regular session, 09:30 → 16:00, against the band's anchor and ±1σ.
 *
 * The y-axis deliberately does NOT force the whole band into view. A weekly σ
 * is several times a normal day's range, so a band-wide axis would flatten the
 * session into a straight line — the one thing this chart exists to show. The
 * domain starts from the day's own high/low and only stretches far enough to
 * swallow a level that is already within reach.
 *
 * A level that stays off the axis is still reported, as a caption pinned to the
 * edge it went past. Dropping it silently would leave the chart claiming the
 * day was near its band when the truth is the opposite — and the arrow says
 * which way, which a line squeezed against the frame could not.
 */
function SessionChart({
  stock,
  compact,
}: {
  stock: StockData;
  compact: boolean;
}) {
  const gradientId = gradientKey(stock.symbol, compact, "session");
  const series = stock.intraday!;
  const data = series.points.map((point) => ({
    time: point.time,
    price: point.close,
  }));
  const prices = data.map((point) => point.price);
  const trend = trendColor(stock.changePercent);

  const low = Math.min(...prices);
  const high = Math.max(...prices);
  // Guard a session that never moved: a zero span would make `reach` zero and
  // the padding collapse the line onto the axis.
  const span = Math.max(high - low, Math.abs(high) * 0.002);
  const reach = span * 0.6;

  const levels: BandLevel[] = [
    {
      key: "upper",
      label: "+1σ",
      value: stock.sigma1Upper,
      stroke: "var(--sigma-upper)",
      strokeOpacity: 0.6,
      dash: "3 4",
      position: "insideTopRight",
    },
    {
      key: "anchor",
      label: "Anchor",
      value: stock.anchor,
      stroke: "var(--foreground)",
      strokeOpacity: 0.35,
      dash: "2 4",
      position: "insideTopLeft",
    },
    {
      key: "lower",
      label: "−1σ",
      value: stock.sigma1Lower,
      stroke: "var(--sigma-lower)",
      strokeOpacity: 0.6,
      dash: "3 4",
      position: "insideBottomRight",
    },
  ];

  let floor = low;
  let ceiling = high;
  for (const level of levels) {
    if (level.value < floor && level.value >= low - reach) floor = level.value;
    if (level.value > ceiling && level.value <= high + reach)
      ceiling = level.value;
  }
  const pad = (ceiling - floor) * 0.12;
  const min = floor - pad;
  const max = ceiling + pad;

  const drawn = levels.filter((l) => l.value >= min && l.value <= max);
  const above = levels.filter((l) => l.value > max);
  const below = levels.filter((l) => l.value < min);

  return (
    <div>
      {!compact && <OffAxisLevels levels={above} direction="up" />}

      <div className={compact ? "h-24 w-full" : "h-44 w-full"}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 6, right: 2, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trend} stopOpacity={0.3} />
                <stop offset="100%" stopColor={trend} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="var(--foreground)"
              strokeOpacity={0.07}
            />

            <YAxis
              domain={[min, max]}
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{
                fill: "var(--muted-foreground)",
                fontSize: compact ? 9 : 10,
              }}
              tickFormatter={axisPrice}
              tickCount={compact ? 3 : 5}
              width={compact ? 40 : 48}
            />
            <XAxis
              dataKey="time"
              ticks={compact ? SESSION_TICKS_COMPACT : SESSION_TICKS}
              tickLine={false}
              axisLine={false}
              tick={edgeTick(compact ? 9 : 10)}
              interval={0}
              height={18}
            />

            {/* Same shading as the band-path chart: inside ±1σ is the ordinary
                half of the week's range. Recharts clips it to the domain, so a
                day sitting under the band shades the whole plot or none of it. */}
            <ReferenceArea
              y1={stock.sigma1Lower}
              y2={stock.sigma1Upper}
              fill="var(--foreground)"
              fillOpacity={0.045}
              stroke="none"
            />

            {drawn.map((level) => (
              <ReferenceLine
                key={level.key}
                y={level.value}
                stroke={level.stroke}
                strokeOpacity={level.strokeOpacity}
                strokeDasharray={level.dash}
                label={
                  compact
                    ? undefined
                    : {
                        value: `${level.label} ${formatCurrency(level.value)}`,
                        // `insideTop*` hangs the caption below its line, so a
                        // level near the floor would set it down among the time
                        // ticks. Flipping it upward there keeps the two apart.
                        position:
                          level.position === "insideTopLeft" &&
                          (level.value - min) / (max - min) < 0.22
                            ? "insideBottomLeft"
                            : level.position,
                        fill: "var(--muted-foreground)",
                        fontSize: 10,
                      }
                }
              />
            ))}

            <Area
              type="linear"
              dataKey="price"
              stroke={trend}
              strokeWidth={1.75}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {!compact && (
        <>
          <OffAxisLevels levels={below} direction="down" />

          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/80">
            {formatDay(series.date)} regular session · {series.candle} bars, ET.
            The axis follows the day, not the week — levels the session never
            reached are named at the edge they sit beyond.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * The levels that fell outside the day's axis, pinned above or below the plot.
 *
 * Forcing them into the domain instead would work — and would compress a quiet
 * day into a flat line five times over, which is the chart's whole point lost.
 */
function OffAxisLevels({
  levels,
  direction,
}: {
  levels: BandLevel[];
  direction: "up" | "down";
}) {
  if (levels.length === 0) return null;

  return (
    <p
      className={cn(
        "num flex flex-wrap items-center gap-x-3 text-[10px] leading-none",
        direction === "up" ? "mb-1.5" : "mt-1.5",
      )}
    >
      <span aria-hidden className="text-muted-foreground/60">
        {direction === "up" ? "↑" : "↓"}
      </span>
      {levels.map((level) => (
        <span
          key={level.key}
          className="text-muted-foreground/80"
          style={{
            color: `color-mix(in oklch, ${level.stroke} 55%, var(--muted-foreground))`,
          }}
        >
          {level.label} {formatCurrency(level.value)}
        </span>
      ))}
    </p>
  );
}

/**
 * Fallback for symbols the intraday feed missed: the original band path, a
 * month of closes with the whole band held in view.
 */
function BandPathChart({
  stock,
  compact,
}: {
  stock: StockData;
  compact: boolean;
}) {
  const gradientId = gradientKey(stock.symbol, compact, "band");
  const data = stock.history.map((bar) => ({
    date: bar.date,
    price: bar.close,
  }));
  const prices = data.map((point) => point.price);
  const low = Math.min(...prices, stock.sigmaExtremeLower);
  const high = Math.max(...prices, stock.sigmaExtremeUpper);
  const pad = (high - low) * 0.12;
  const trend = trendColor(stock.changePercent);

  // Enough labels to date the span without crowding: the ends, plus a midpoint
  // on the wide variant.
  const dateTicks = compact
    ? [data[0]?.date, data.at(-1)?.date]
    : [
        data[0]?.date,
        data[Math.floor(data.length / 2)]?.date,
        data.at(-1)?.date,
      ];

  return (
    <div className={compact ? "h-24 w-full" : "h-44 w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 6, right: 2, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trend} stopOpacity={0.3} />
              <stop offset="100%" stopColor={trend} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="var(--foreground)"
            strokeOpacity={0.07}
          />

          <YAxis
            domain={[low - pad, high + pad]}
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={{
              fill: "var(--muted-foreground)",
              fontSize: compact ? 9 : 10,
            }}
            tickFormatter={axisPrice}
            tickCount={compact ? 3 : 5}
            width={compact ? 40 : 48}
          />
          <XAxis
            dataKey="date"
            ticks={dateTicks.filter((date): date is string => Boolean(date))}
            tickLine={false}
            axisLine={false}
            tick={edgeTick(compact ? 9 : 10, formatDay)}
            interval={0}
            height={18}
          />

          <ReferenceArea
            y1={stock.sigma1Lower}
            y2={stock.sigma1Upper}
            fill="var(--foreground)"
            fillOpacity={0.045}
            stroke="none"
          />
          <ReferenceLine
            y={stock.sigmaExtremeUpper}
            stroke="var(--sigma-hot)"
            strokeOpacity={0.5}
            strokeDasharray="3 4"
          />
          <ReferenceLine
            y={stock.sigmaExtremeLower}
            stroke="var(--sigma-cold)"
            strokeOpacity={0.5}
            strokeDasharray="3 4"
          />
          <ReferenceLine
            y={stock.anchor}
            stroke="var(--foreground)"
            strokeOpacity={0.35}
            strokeDasharray="2 4"
            label={
              compact
                ? undefined
                : {
                    value: `Anchor ${formatCurrency(stock.anchor)}`,
                    position: "insideTopLeft",
                    fill: "var(--muted-foreground)",
                    fontSize: 10,
                  }
            }
          />

          <Area
            type="linear"
            dataKey="price"
            stroke={trend}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
