"use client";

import * as React from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatDay, formatSigma } from "@/lib/format";
import { SIGMA_1, buildWeeklyBand, type WeeklyBandResult } from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * One row: a symbol and the two bands that have already settled, oldest first,
 * next to the band it is in now.
 *
 * Both settled slots are optional and independently so. The publisher fills
 * them positionally — a symbol added mid-week has no anchor σ cached for the
 * weeks before it joined — and a missing week is shown as missing rather than
 * being back-filled from current implied volatility, which would price a
 * finished week on a ruler that did not exist yet.
 */
interface RecapRow {
  stock: StockData;
  weekBeforeLast: WeeklyBandResult | null;
  lastWeek: WeeklyBandResult | null;
}

type RecapSort = "LAST_WEEK" | "SWING" | "CURRENT" | "SYMBOL";

/**
 * `narrow: false` marks a sort whose column is hidden on a phone. Offering it
 * there would reorder the table by a number the reader cannot see.
 */
const SORTS: { key: RecapSort; label: string; narrow: boolean }[] = [
  { key: "LAST_WEEK", label: "Last week", narrow: true },
  { key: "SWING", label: "Biggest swing", narrow: false },
  { key: "CURRENT", label: "This week", narrow: true },
  { key: "SYMBOL", label: "Symbol", narrow: true },
];

interface WeeklyRecapTableProps {
  stocks: StockData[];
  onSelect: (symbol: string) => void;
}

export function WeeklyRecapTable({ stocks, onSelect }: WeeklyRecapTableProps) {
  const [sort, setSort] = React.useState<RecapSort>("LAST_WEEK");

  const rows = React.useMemo<RecapRow[]>(
    () =>
      stocks.map((stock) => ({
        stock,
        weekBeforeLast: stock.weekBeforeLast
          ? buildWeeklyBand(stock.weekBeforeLast)
          : null,
        lastWeek: stock.lastWeek ? buildWeeklyBand(stock.lastWeek) : null,
      })),
    [stocks],
  );

  const sorted = React.useMemo(() => {
    const next = [...rows];
    // Rows without a settled band cannot take part in a magnitude sort, so they
    // are parked at the bottom instead of being ranked as if their z were 0 —
    // "no data" is not the same claim as "did not move".
    const byMagnitude = (pick: (row: RecapRow) => number | null) =>
      next.sort((a, b) => {
        const av = pick(a);
        const bv = pick(b);
        if (av === null || bv === null) {
          if (av === bv) return a.stock.symbol.localeCompare(b.stock.symbol);
          return av === null ? 1 : -1;
        }
        return (
          Math.abs(bv) - Math.abs(av) ||
          a.stock.symbol.localeCompare(b.stock.symbol)
        );
      });

    switch (sort) {
      case "LAST_WEEK":
        return byMagnitude((row) => row.lastWeek?.closeZ ?? null);
      case "SWING":
        // The change between the two settled weeks, which is the one number
        // neither column shows on its own. Needs both weeks to mean anything.
        return byMagnitude((row) =>
          row.lastWeek && row.weekBeforeLast
            ? row.lastWeek.closeZ - row.weekBeforeLast.closeZ
            : null,
        );
      case "CURRENT":
        return byMagnitude((row) => row.stock.zScore);
      case "SYMBOL":
        return next.sort((a, b) =>
          a.stock.symbol.localeCompare(b.stock.symbol),
        );
    }
  }, [rows, sort]);

  const covered = rows.filter((row) => row.lastWeek !== null);
  const older = rows.filter((row) => row.weekBeforeLast !== null);
  const lastEnd = covered[0]?.lastWeek?.closeDate;
  const olderEnd = older[0]?.weekBeforeLast?.closeDate;
  const missing = rows.length - covered.length;
  const breached = covered.filter(
    (row) => Math.abs(row.lastWeek!.closeZ) >= SIGMA_1,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-[13px] text-muted-foreground">
          {lastEnd ? (
            <>
              Two settled weeks, each scored at its own Friday close
              {olderEnd ? <> — {formatDay(olderEnd)}, then {formatDay(lastEnd)}</> : null}.{" "}
              <span className="text-foreground/80">
                {breached} of {covered.length}
              </span>{" "}
              closed last week outside their ±1σ range.
            </>
          ) : (
            <>No settled band available for the previous week yet.</>
          )}
        </p>

        <div
          role="group"
          aria-label="Sort the weekly recap"
          className="flex items-center gap-1 rounded-lg border border-border/70 p-0.5"
        >
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSort(option.key)}
              aria-pressed={sort === option.key}
              className={cn(
                "cursor-pointer rounded-[6px] px-2.5 py-1 text-[11px] font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                !option.narrow && "hidden sm:block",
                sort === option.key
                  ? "bg-[color-mix(in_oklch,var(--foreground)_9%,transparent)] text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass overflow-hidden p-0">
        {/* No card stack on small screens: the point of this view is reading
            the same symbol's σ across consecutive weeks on one line, and
            reflowing them onto separate lines destroys exactly that. The two
            most recent columns always fit; the oldest week drops away as the
            viewport narrows. */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left sm:min-w-[42rem]">
            <caption className="sr-only">
              Each tracked symbol&apos;s z-score at the close of the two weeks
              that have already settled, and its z-score in the band running
              now.
            </caption>
            <thead>
              <tr className="border-b border-border/60">
                <Th className="pl-4">Symbol</Th>
                <Th align="right" className="hidden sm:table-cell">
                  Two weeks ago
                  <Sub>
                    {olderEnd ? `${formatDay(olderEnd)} close` : "at the close"}
                  </Sub>
                </Th>
                <Th align="right">
                  Last week
                  <Sub>
                    {lastEnd ? `${formatDay(lastEnd)} close` : "at the close"}
                  </Sub>
                </Th>
                <Th align="right">
                  This week
                  <Sub>current</Sub>
                </Th>
                <Th className="hidden pr-4 md:table-cell" align="right">
                  Now
                </Th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <Row key={row.stock.symbol} row={row} onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {missing > 0 && (
        <p className="text-xs text-muted-foreground/80">
          {missing} symbol{missing === 1 ? "" : "s"} have no settled band for
          last week — they joined the universe after that Friday&apos;s anchor
          was struck. Their weekly σ is never back-filled from current implied
          volatility, so the column stays empty rather than showing a figure
          measured on a different ruler.
        </p>
      )}
    </div>
  );
}

function Row({
  row,
  onSelect,
}: {
  row: RecapRow;
  onSelect: (symbol: string) => void;
}) {
  const { stock, weekBeforeLast, lastWeek } = row;

  return (
    <tr
      onClick={() => onSelect(stock.symbol)}
      className="cursor-pointer border-b border-border/40 transition-colors last:border-0 hover:bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)]"
    >
      <td className="py-2.5 pl-4">
        <button
          type="button"
          onClick={(event) => {
            // The row already handles the click; without this the panel would
            // open twice and the second call would fight the first.
            event.stopPropagation();
            onSelect(stock.symbol);
          }}
          className="cursor-pointer rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="num text-[13px] font-semibold">{stock.symbol}</span>
          <span className="ml-2 hidden text-[11px] text-muted-foreground/80 sm:inline">
            {stock.sector}
          </span>
        </button>
      </td>

      <SigmaCell
        value={weekBeforeLast?.closeZ ?? null}
        className="hidden sm:table-cell"
      />

      {/* The step between the two settled weeks rides in this cell rather than
          taking a column of its own: it is a comparison, not a reading, and it
          only exists when both weeks do. */}
      <td className="py-2.5 text-right">
        {lastWeek ? (
          <span className="inline-flex items-baseline justify-end gap-1.5">
            {weekBeforeLast && (
              <Step from={weekBeforeLast.closeZ} to={lastWeek.closeZ} />
            )}
            <SigmaText value={lastWeek.closeZ} />
          </span>
        ) : (
          <Empty />
        )}
      </td>

      {/* Carries the right-hand gutter until the status badge reappears and
          takes it over at md. */}
      <SigmaCell value={stock.zScore} strong className="pr-4 md:pr-0" />

      <td className="hidden py-2.5 pr-4 text-right md:table-cell">
        <StatusBadge status={stock.status} />
      </td>
    </tr>
  );
}

/**
 * Direction of travel between the two settled weeks.
 *
 * Signed on the raw z, not on distance from the anchor: −1.2σ following +0.3σ
 * is a fall even though both weeks "moved away from zero", and an arrow that
 * pointed up there would invert the story the column exists to tell.
 */
function Step({ from, to }: { from: number; to: number }) {
  const delta = to - from;
  // Under a tenth of a σ is inside the rounding the columns themselves print;
  // drawing an arrow for it would claim a direction the numbers do not show.
  if (Math.abs(delta) < 0.1) {
    return (
      <ArrowRight
        className="size-3 text-muted-foreground/40"
        aria-label="flat versus the week before"
      />
    );
  }
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  return (
    <Icon
      className={cn("size-3", delta > 0 ? "text-up" : "text-down")}
      aria-label={`${formatSigma(delta)} versus the week before`}
    />
  );
}

/** A signed σ reading, or an explicit blank when the band could not be built. */
function SigmaCell({
  value,
  strong = false,
  className,
}: {
  value: number | null;
  strong?: boolean;
  className?: string;
}) {
  return (
    <td className={cn("py-2.5 text-right", className)}>
      {value === null ? <Empty /> : <SigmaText value={value} strong={strong} />}
    </td>
  );
}

/**
 * Readings inside ±1σ are deliberately dimmed. Every row carries three of these
 * numbers, and if they all shout the two that matter — the ones that left the
 * range — stop being findable by scanning the column.
 */
function SigmaText({
  value,
  strong = false,
}: {
  value: number;
  strong?: boolean;
}) {
  const beyond = Math.abs(value) >= SIGMA_1;
  const Icon = value > 0 ? ArrowUp : ArrowDown;

  return (
    <span
      className={cn(
        "num inline-flex items-center justify-end gap-1 text-[13px]",
        beyond
          ? value > 0
            ? "font-semibold text-[var(--sigma-upper)]"
            : "font-semibold text-[var(--sigma-lower)]"
          : strong
            ? "text-foreground/85"
            : "text-muted-foreground",
      )}
    >
      {beyond && <Icon className="size-3" aria-hidden />}
      {formatSigma(value)}
    </span>
  );
}

function Empty() {
  return (
    <span
      className="text-[13px] text-muted-foreground/40"
      title="No settled band for this symbol that week"
    >
      —
    </span>
  );
}

function Th({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "label-xs py-2.5 align-bottom font-medium",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[10px] tracking-normal normal-case text-muted-foreground/60">
      {children}
    </span>
  );
}
