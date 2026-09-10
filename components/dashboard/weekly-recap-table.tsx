"use client";

import * as React from "react";
import { ArrowDown, ArrowRight, ArrowUp, Search, X } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Input } from "@/components/ui/input";
import { formatDay, formatSigma } from "@/lib/format";
import {
  SIGMA_1,
  buildWeeklyBand,
  matchesQuery,
  type WeeklyBandResult,
} from "@/lib/sigma";
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
const SORTS: { key: RecapSort; narrow: boolean }[] = [
  { key: "LAST_WEEK", narrow: true },
  { key: "SWING", narrow: false },
  { key: "CURRENT", narrow: true },
  { key: "SYMBOL", narrow: true },
];

interface WeeklyRecapTableProps {
  stocks: StockData[];
  onSelect: (symbol: string) => void;
}

export function WeeklyRecapTable({ stocks, onSelect }: WeeklyRecapTableProps) {
  const { pick } = useLocale();
  const [sort, setSort] = React.useState<RecapSort>("LAST_WEEK");
  const [query, setQuery] = React.useState("");

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

  const visible = React.useMemo(
    () => sorted.filter((row) => matchesQuery(row.stock, query)),
    [sorted, query],
  );

  // Deliberately counted over every row, not the visible ones: the sentence is
  // a claim about how the week went for the board, and narrowing it to whatever
  // is typed in the box would turn it into a different, misleading statistic.
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
              {pick("종료된 2개 주간을 각각의 금요일 마감 기준으로 계산", "Two settled weeks, each scored at its own Friday close")}
              {olderEnd ? <> — {formatDay(olderEnd)}, {pick("그다음", "then")} {formatDay(lastEnd)}</> : null}.{" "}
              <span className="text-foreground/80">
                {pick(`${covered.length}개 중 ${breached}개`, `${breached} of ${covered.length}`)}
              </span>{" "}
              {pick("종목이 지난주 ±1σ 범위 밖에서 마감했습니다.", "closed last week outside their ±1σ range.")}
            </>
          ) : (
            <>{pick("지난주의 종료된 밴드가 아직 없습니다.", "No settled band available for the previous week yet.")}</>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-48">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={pick("티커 검색", "Search ticker")}
              aria-label={pick("주간 리캡 티커 검색", "Search the weekly recap by ticker")}
              className="h-8 pr-8 pl-8 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={pick("검색 초기화", "Clear search")}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label={pick("주간 리캡 정렬", "Sort the weekly recap")}
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
                {{ LAST_WEEK: pick("지난주", "Last week"), SWING: pick("최대 변화", "Biggest swing"), CURRENT: pick("이번 주", "This week"), SYMBOL: pick("종목", "Symbol") }[option.key]}
              </button>
            ))}
          </div>
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
              {pick("각 종목의 지난 2주 마감 z-score와 현재 밴드의 z-score", "Each tracked symbol’s z-score at the close of the two weeks that have already settled, and its z-score in the band running now.")}
            </caption>
            <thead>
              <tr className="border-b border-border/60">
                <Th className="pl-4">{pick("종목", "Symbol")}</Th>
                <Th align="right" className="hidden sm:table-cell">
                  {pick("2주 전", "Two weeks ago")}
                  <Sub>
                    {olderEnd ? `${formatDay(olderEnd)} ${pick("마감", "close")}` : pick("마감 기준", "at the close")}
                  </Sub>
                </Th>
                <Th align="right">
                  {pick("지난주", "Last week")}
                  <Sub>
                    {lastEnd ? `${formatDay(lastEnd)} ${pick("마감", "close")}` : pick("마감 기준", "at the close")}
                  </Sub>
                </Th>
                <Th align="right" className="pr-4 md:pr-0">
                  {pick("이번 주", "This week")}
                  <Sub>{pick("현재", "current")}</Sub>
                </Th>
                <Th className="hidden pr-4 md:table-cell" align="right">
                  {pick("현재", "Now")}
                </Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <Row key={row.stock.symbol} row={row} onSelect={onSelect} />
              ))}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] text-muted-foreground">
              {pick("조건에 맞는 추적 종목이 없습니다:", "No tracked symbol matches")}{" "}
              <span className="num text-foreground/80">{query.trim()}</span>.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-3 cursor-pointer rounded-md border border-border/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {pick("검색 초기화", "Clear search")}
            </button>
          </div>
        )}
      </div>

      {missing > 0 && (
        <p className="text-xs text-muted-foreground/80">
          {pick(`${missing}개 종목은 지난주 밴드가 없습니다. 해당 금요일 앵커 설정 후 추적 대상에 포함됐습니다. 주간 σ를 현재 implied volatility로 소급 채우지 않으므로, 다른 기준으로 측정한 값 대신 빈칸으로 남겁니다.`, `${missing} symbol${missing === 1 ? "" : "s"} have no settled band for last week — they joined the universe after that Friday’s anchor was struck. Their weekly σ is never back-filled from current implied volatility, so the column stays empty rather than showing a figure measured on a different ruler.`)}
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
          only exists when both weeks do. It also drops below sm, where the week
          it compares against is not on screen — same reason the SWING sort is
          withheld there, and without it the cell shows two arrows in two
          different colours with nothing to explain the first. */}
      <td className="py-2.5 text-right">
        {lastWeek ? (
          <span className="inline-flex items-baseline justify-end gap-1.5">
            {weekBeforeLast && (
              <span className="hidden sm:inline-flex">
                <Step from={weekBeforeLast.closeZ} to={lastWeek.closeZ} />
              </span>
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
  const { pick } = useLocale();
  const delta = to - from;
  // Under a tenth of a σ is inside the rounding the columns themselves print;
  // drawing an arrow for it would claim a direction the numbers do not show.
  if (Math.abs(delta) < 0.1) {
    return (
      <ArrowRight
        className="size-3 text-muted-foreground/40"
        aria-label={pick("전주 대비 변화 없음", "flat versus the week before")}
      />
    );
  }
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  return (
    <Icon
      className={cn("size-3", delta > 0 ? "text-up" : "text-down")}
      aria-label={pick(`전주 대비 ${formatSigma(delta)}`, `${formatSigma(delta)} versus the week before`)}
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
  const { pick } = useLocale();
  return (
    <span
      className="text-[13px] text-muted-foreground/40"
      title={pick("해당 주의 종료된 밴드 없음", "No settled band for this symbol that week")}
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
