"use client";

import { formatSigma } from "@/lib/format";
import {
  SIGMA_EXTREME,
  STATUS_META,
  STATUS_ORDER,
  bandPosition,
  statusStyle,
  type StatusCounts,
} from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SIGMA } from "./sigma-glyph";

const BUCKET_WIDTH = 2.6;
const ROW_PITCH = 11;
const AXIS_HEIGHT = 48;

interface SigmaOverviewProps {
  stocks: StockData[];
  counts: StatusCounts;
  onSelect: (symbol: string) => void;
}

export function SigmaOverview({
  stocks,
  counts,
  onSelect,
}: SigmaOverviewProps) {
  const plotted = layout(stocks);
  const maxRow = plotted.reduce((max, item) => Math.max(max, item.row), 0);
  const insideBand = counts.total - counts.beyondUpper1 - counts.beyondLower1;

  const overheated = [...stocks]
    .sort((a, b) => b.zScore - a.zScore)
    .slice(0, 3);
  const oversold = [...stocks].sort((a, b) => a.zScore - b.zScore).slice(0, 3);

  return (
    <div className="glass grid gap-8 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-10">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="font-heading text-base font-medium">
              Distribution across the band
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every tracked symbol placed by how far it sits from its own anchor close.
            </p>
          </div>
          <Legend />
        </div>

        <div
          className="relative mt-8"
          style={{ height: (maxRow + 1) * ROW_PITCH + AXIS_HEIGHT }}
        >
          {plotted.map(({ stock, x, row }) => {
            const isExtreme =
              stock.status === "OVERHEATED" || stock.status === "OVERSOLD";
            return (
              <button
                key={stock.symbol}
                type="button"
                onClick={() => onSelect(stock.symbol)}
                style={{
                  ...statusStyle(stock.status),
                  left: `${x}%`,
                  bottom: AXIS_HEIGHT + row * ROW_PITCH,
                }}
                className="group absolute -translate-x-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                aria-label={`${stock.symbol} at ${formatSigma(stock.zScore)}`}
              >
                <span
                  className={cn(
                    "block size-2 rounded-full bg-[var(--state)] transition-transform duration-200 group-hover:scale-150",
                    stock.status === "NORMAL" && "opacity-55",
                    isExtreme && "state-glow",
                  )}
                />
                <span className="num pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-md border border-border bg-popover px-1.5 py-0.5 text-[10px] whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                  {stock.symbol} {formatSigma(stock.zScore, 2)}
                </span>
              </button>
            );
          })}

          <Axis />
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-border/70 pt-5">
          <Stat label="Average z-score" value={formatSigma(counts.averageZ)} />
          <Stat
            label={<>Inside ±1{SIGMA}</>}
            value={`${insideBand} / ${counts.total}`}
            hint={`${Math.round((insideBand / counts.total) * 100)}% of universe`}
          />
          <Stat
            label="Approaching an edge"
            value={String(counts.approaching)}
            hint="|z| ≥ 0.85, still normal"
          />
        </dl>
      </div>

      <div className="flex min-w-0 flex-col gap-5 border-t border-border/70 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
        <ExtremeList
          title="Most overheated"
          stocks={overheated}
          onSelect={onSelect}
        />
        <ExtremeList
          title="Most oversold"
          stocks={oversold}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

function Axis() {
  const ticks = [
    { z: -SIGMA_EXTREME, label: "−1.5σ", dropped: true },
    { z: -1, label: "−1σ", dropped: false },
    { z: 0, label: "Anchor", dropped: false },
    { z: 1, label: "+1σ", dropped: false },
    { z: SIGMA_EXTREME, label: "+1.5σ", dropped: true },
  ];

  return (
    <div className="absolute inset-x-0 bottom-0" style={{ height: AXIS_HEIGHT }}>
      <div className="absolute inset-x-0 top-0 h-px hairline-x" />
      {ticks.map((tick) => (
        <span
          key={tick.label}
          className="absolute top-0 -translate-x-1/2"
          style={{ left: `${bandPosition(tick.z)}%` }}
        >
          <span
            aria-hidden
            className={cn(
              "block h-2 w-px",
              tick.z === 0
                ? "bg-[color-mix(in_oklch,var(--foreground)_40%,transparent)]"
                : "bg-[color-mix(in_oklch,var(--foreground)_20%,transparent)]",
            )}
          />
          <span
            className={cn(
              // ±1.5σ drops a row so it never collides with ±1σ on narrow screens.
              "num mt-1.5 block text-[10px] whitespace-nowrap",
              tick.dropped && "mt-4",
              tick.z === 0 ? "text-foreground/70" : "text-muted-foreground/70",
            )}
            style={{ transform: "translateX(-50%)", marginLeft: "0.5px" }}
          >
            {tick.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {STATUS_ORDER.map((status) => (
        <li
          key={status}
          style={statusStyle(status)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full bg-[var(--state)]",
              status === "NORMAL" && "opacity-55",
            )}
          />
          {STATUS_META[status].longLabel}
        </li>
      ))}
    </ul>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: React.ReactNode;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="label-xs">{label}</dt>
      <dd className="num mt-1.5 text-lg leading-none font-semibold">{value}</dd>
      {hint && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/70">{hint}</p>
      )}
    </div>
  );
}

function ExtremeList({
  title,
  stocks,
  onSelect,
}: {
  title: string;
  stocks: StockData[];
  onSelect: (symbol: string) => void;
}) {
  return (
    <div>
      <h3 className="label-xs">{title}</h3>
      <ul className="mt-2.5 space-y-1">
        {stocks.map((stock) => (
          <li key={stock.symbol}>
            <button
              type="button"
              onClick={() => onSelect(stock.symbol)}
              style={statusStyle(stock.status)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="num w-14 shrink-0 text-xs font-semibold">
                {stock.symbol}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {stock.name}
              </span>
              <span className="num state-tint ml-auto shrink-0 text-xs font-semibold">
                {formatSigma(stock.zScore)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Strip plot: bucket by horizontal position, stack collisions upward. */
function layout(stocks: StockData[]) {
  const heights = new Map<number, number>();

  return [...stocks]
    .sort((a, b) => a.zScore - b.zScore)
    .map((stock) => {
      const x = bandPosition(stock.zScore);
      const bucket = Math.round(x / BUCKET_WIDTH);
      const row = heights.get(bucket) ?? 0;
      heights.set(bucket, row + 1);
      return { stock, x, row };
    });
}
