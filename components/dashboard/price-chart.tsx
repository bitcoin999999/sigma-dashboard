"use client";

import {
  Area,
  AreaChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrency, formatDay } from "@/lib/format";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Time labels on the intraday axis. Missing bars simply drop their tick. */
const SESSION_TICKS = ["09:30", "11:00", "12:30", "14:00", "16:00"];

export function PriceChart({ stock }: { stock: StockData }) {
  return stock.intraday ? (
    <SessionChart stock={stock} />
  ) : (
    <BandPathChart stock={stock} />
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
function SessionChart({ stock }: { stock: StockData }) {
  const series = stock.intraday!;
  const data = series.points.map((point) => ({
    time: point.time,
    price: point.close,
  }));
  const prices = data.map((point) => point.price);

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
    if (level.value > ceiling && level.value <= high + reach) ceiling = level.value;
  }
  const pad = (ceiling - floor) * 0.12;
  const min = floor - pad;
  const max = ceiling + pad;

  const drawn = levels.filter((l) => l.value >= min && l.value <= max);
  const above = levels.filter((l) => l.value > max);
  const below = levels.filter((l) => l.value < min);

  return (
    <div>
      <OffAxisLevels levels={above} direction="up" />

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 6, right: 0, bottom: 0, left: 0 }}
          >
            <defs>
              <linearGradient id="sigma-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--state)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--state)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <YAxis domain={[min, max]} hide />
            <XAxis
              dataKey="time"
              ticks={SESSION_TICKS}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
              tickMargin={4}
              interval={0}
              height={16}
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
                label={{
                  value: `${level.label} ${formatCurrency(level.value)}`,
                  // `insideTop*` hangs the caption below its line, so a level
                  // near the floor would set it down among the time ticks.
                  // Flipping it upward there keeps the two apart.
                  position:
                    level.position === "insideTopLeft" &&
                    (level.value - min) / (max - min) < 0.22
                      ? "insideBottomLeft"
                      : level.position,
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
              />
            ))}

            <Area
              type="linear"
              dataKey="price"
              stroke="var(--state)"
              strokeWidth={1.75}
              fill="url(#sigma-area)"
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <OffAxisLevels levels={below} direction="down" />

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/80">
        {formatDay(series.date)} regular session · {series.candle} bars, ET. The
        axis follows the day, not the week — levels the session never reached
        are named at the edge they sit beyond.
      </p>
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
function BandPathChart({ stock }: { stock: StockData }) {
  const data = stock.history.map((bar) => ({
    date: bar.date,
    price: bar.close,
  }));
  const prices = data.map((point) => point.price);
  const low = Math.min(...prices, stock.sigmaExtremeLower);
  const high = Math.max(...prices, stock.sigmaExtremeUpper);
  const pad = (high - low) * 0.12;

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sigma-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--state)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--state)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <YAxis domain={[low - pad, high + pad]} hide />

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
            label={{
              value: `Anchor ${formatCurrency(stock.anchor)}`,
              position: "insideTopLeft",
              fill: "var(--muted-foreground)",
              fontSize: 10,
            }}
          />

          <Area
            type="monotone"
            dataKey="price"
            stroke="var(--state)"
            strokeWidth={1.75}
            fill="url(#sigma-area)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
