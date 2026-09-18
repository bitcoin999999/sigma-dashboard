"use client";

import { Activity, Flame, Snowflake, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SIGMA } from "@/components/dashboard/sigma-glyph";
import { useLocale } from "@/components/locale-provider";
import { STATUS_COPY } from "@/lib/i18n";
import { STATUS_ORDER, statusStyle } from "@/lib/sigma";
import type { SigmaStatus, StockData } from "@/lib/types";
import type { StatusCounts } from "@/lib/sigma";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  counts: StatusCounts;
  previousCounts: StatusCounts;
  stocks: StockData[];
}

export function SummaryCards({
  counts,
  previousCounts,
  stocks,
}: SummaryCardsProps) {
  const { pick } = useLocale();
  const distribution = STATUS_ORDER.map((status) => ({
    status,
    value: stocks.filter((stock) => stock.status === status).length,
  }));

  return (
    <>
      {/* Four numbers and four short labels do not need four cards. Below `lg`
          they are one strip: the counts stay legible, the framing that cost a
          screen's worth of height goes away, and the rail — the only part that
          says anything the numbers do not — moves under all four. */}
      <div className="glass grid grid-cols-4 gap-px p-3 lg:hidden">
        <CompactStat
          label={pick("추적", "Tracked")}
          value={counts.total}
        />
        <CompactStat
          label={<>+1{SIGMA}</>}
          value={counts.beyondUpper1}
          delta={counts.beyondUpper1 - previousCounts.beyondUpper1}
          status="UPPER_1SIGMA"
        />
        <CompactStat
          label={<>+1.5{SIGMA}</>}
          value={counts.overheated}
          delta={counts.overheated - previousCounts.overheated}
          status="OVERHEATED"
        />
        <CompactStat
          label={<>−1.5{SIGMA}</>}
          value={counts.oversold}
          delta={counts.oversold - previousCounts.oversold}
          status="OVERSOLD"
        />
        <div className="col-span-4">
          <DistributionRail distribution={distribution} total={counts.total} />
        </div>
      </div>

      <div className="hidden grid-cols-2 gap-3 lg:grid lg:grid-cols-4">
      <SummaryCard
        icon={Activity}
        label={pick("시장 상태", "Market Status")}
        value={counts.total}
        unit={pick("종목", "Stocks")}
        caption={pick("추적 종목", "Tracked universe")}
      >
        <DistributionRail distribution={distribution} total={counts.total} />
      </SummaryCard>

      <SummaryCard
        icon={TrendingUp}
        label={<>Upper 1{SIGMA}</>}
        value={counts.beyondUpper1}
        unit={pick("종목", "Stocks")}
        caption={pick("+1σ 상단 이상", "Above the +1σ edge")}
        delta={counts.beyondUpper1 - previousCounts.beyondUpper1}
        status="UPPER_1SIGMA"
      />

      <SummaryCard
        icon={Flame}
        label={<>Above +1.5{SIGMA}</>}
        value={counts.overheated}
        unit={pick("종목", "Stocks")}
        caption={pick("통계적 overheated", "Statistically overheated")}
        delta={counts.overheated - previousCounts.overheated}
        status="OVERHEATED"
      />

      <SummaryCard
        icon={Snowflake}
        label={<>Below −1.5{SIGMA}</>}
        value={counts.oversold}
        unit={pick("종목", "Stocks")}
        caption={pick("통계적 oversold", "Statistically oversold")}
        delta={counts.oversold - previousCounts.oversold}
        status="OVERSOLD"
      />
      </div>
    </>
  );
}

function CompactStat({
  label,
  value,
  delta,
  status,
}: {
  label: React.ReactNode;
  value: number;
  delta?: number;
  status?: SigmaStatus;
}) {
  return (
    <div
      style={status ? statusStyle(status) : undefined}
      className="border-l border-border/50 px-2 first:border-0 first:pl-0"
    >
      <p className="label-xs truncate">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            "num text-xl leading-none font-semibold tracking-tight",
            status && "state-tint",
          )}
        >
          {value}
        </span>
        {delta !== undefined && delta !== 0 && (
          <span className="num text-[11px] text-muted-foreground">
            {delta > 0 ? "+" : "−"}
            {Math.abs(delta)}
          </span>
        )}
      </p>
    </div>
  );
}

interface SummaryCardProps {
  icon: LucideIcon;
  label: React.ReactNode;
  value: number;
  unit: string;
  caption: string;
  delta?: number;
  status?: SigmaStatus;
  children?: React.ReactNode;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  unit,
  caption,
  delta,
  status,
  children,
}: SummaryCardProps) {
  const { pick } = useLocale();
  return (
    <div
      style={status ? statusStyle(status) : undefined}
      className="glass flex flex-col justify-between gap-4 p-4 sm:gap-5 sm:p-5"
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <span className="label-xs">{label}</span>
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-lg border border-border/70 bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)]",
            status && "state-chip",
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="num text-[1.75rem] leading-none font-semibold tracking-tight sm:text-[2rem]">
            {value}
          </span>
          <span className="text-sm text-muted-foreground">{unit}</span>
          {delta !== undefined && delta !== 0 && (
            <span
              className={cn(
                "num ml-auto text-xs font-medium",
                delta > 0 ? "text-foreground/80" : "text-muted-foreground",
              )}
            >
              {delta > 0 ? "+" : "−"}
              {Math.abs(delta)}
            </span>
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {caption}
          {delta !== undefined && delta !== 0 && (
            <span className="text-muted-foreground/60"> {pick("· 직전 세션 대비", "· vs prior session")}</span>
          )}
        </p>

        {children}
      </div>
    </div>
  );
}

function DistributionRail({
  distribution,
  total,
}: {
  distribution: { status: SigmaStatus; value: number }[];
  total: number;
}) {
  const { locale } = useLocale();
  return (
    <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
      {distribution.map(({ status, value }) => (
        <span
          key={status}
          style={{
            ...statusStyle(status),
            width: `${total ? (value / total) * 100 : 0}%`,
          }}
          title={`${STATUS_COPY[locale][status].longLabel}: ${value}`}
          className={cn(
            "h-full rounded-full bg-[var(--state)]",
            status === "NORMAL" && "opacity-30",
          )}
        />
      ))}
    </div>
  );
}
