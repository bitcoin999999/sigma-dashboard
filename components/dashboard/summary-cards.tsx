import { Activity, Flame, Snowflake, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SIGMA } from "@/components/dashboard/sigma-glyph";
import { STATUS_META, STATUS_ORDER, statusStyle } from "@/lib/sigma";
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
  const distribution = STATUS_ORDER.map((status) => ({
    status,
    value: stocks.filter((stock) => stock.status === status).length,
  }));

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard
        icon={Activity}
        label="Market Status"
        value={counts.total}
        unit="Stocks"
        caption="Tracked universe"
      >
        <DistributionRail distribution={distribution} total={counts.total} />
      </SummaryCard>

      <SummaryCard
        icon={TrendingUp}
        label={<>Upper 1{SIGMA}</>}
        value={counts.beyondUpper1}
        unit="Stocks"
        caption="Above the +1σ edge"
        delta={counts.beyondUpper1 - previousCounts.beyondUpper1}
        status="UPPER_1SIGMA"
      />

      <SummaryCard
        icon={Flame}
        label={<>Above +1.5{SIGMA}</>}
        value={counts.overheated}
        unit="Stocks"
        caption="Statistically overheated"
        delta={counts.overheated - previousCounts.overheated}
        status="OVERHEATED"
      />

      <SummaryCard
        icon={Snowflake}
        label={<>Below −1.5{SIGMA}</>}
        value={counts.oversold}
        unit="Stocks"
        caption="Statistically oversold"
        delta={counts.oversold - previousCounts.oversold}
        status="OVERSOLD"
      />
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
            <span className="text-muted-foreground/60"> · vs prior session</span>
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
  return (
    <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
      {distribution.map(({ status, value }) => (
        <span
          key={status}
          style={{
            ...statusStyle(status),
            width: `${total ? (value / total) * 100 : 0}%`,
          }}
          title={`${STATUS_META[status].longLabel}: ${value}`}
          className={cn(
            "h-full rounded-full bg-[var(--state)]",
            status === "NORMAL" && "opacity-30",
          )}
        />
      ))}
    </div>
  );
}
