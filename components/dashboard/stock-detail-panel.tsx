"use client";

import * as React from "react";
import Link from "next/link";

import { ArrowUpRight, X } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { Dialog, DialogClose, DialogPortal } from "@/components/ui/dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  formatCurrency,
  formatPercent,
  formatSigma,
  formatSignedNumber,
} from "@/lib/format";
import { STATUS_COPY } from "@/lib/i18n";
import { statusStyle } from "@/lib/sigma";
import type { EarningsEvent } from "@/lib/econ-calendar";
import { SESSION_LABEL } from "@/lib/calendar-state";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ChangePill } from "./change-pill";
import { GexPanel } from "./gex-panel";
import { PriceChart } from "./price-chart";
import { SigmaRangeBar } from "./sigma-range-bar";
import { StatusBadge } from "./status-badge";

interface StockDetailPanelProps {
  stock: StockData | null;
  earnings?: EarningsEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockDetailPanel({
  stock,
  earnings,
  open,
  onOpenChange,
}: StockDetailPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] duration-200 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup
          className={cn(
            "glass fixed z-50 flex flex-col overflow-hidden outline-none duration-300",
            // Bottom sheet on phones, right-hand rail from sm up.
            "inset-x-0 bottom-0 max-h-[88svh] rounded-b-none",
            "sm:inset-y-3 sm:right-3 sm:left-auto sm:max-h-none sm:w-[26rem] sm:rounded-2xl",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-6 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-6",
            "sm:data-closed:slide-out-to-right-6 sm:data-open:slide-in-from-right-6",
          )}
        >
          {/* Keyed on the symbol so switching tickers resets the view tab —
              a GEX ladder left over from the previous symbol would read as
              this one's. */}
          {stock && <DetailContent key={stock.symbol} stock={stock} earnings={earnings} />}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

type DetailView = "GEX" | "BAND";

function DetailContent({ stock, earnings }: { stock: StockData; earnings?: EarningsEvent | null }) {
  const { locale, pick } = useLocale();
  const meta = STATUS_COPY[locale][stock.status];
  // GEX is the headline view when the options feed carried this symbol; the
  // price path stays one click away rather than being replaced outright.
  const [view, setView] = React.useState<DetailView>(
    stock.gex ? "GEX" : "BAND",
  );

  return (
    <div style={statusStyle(stock.status)} className="flex min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <DialogPrimitive.Title className="num text-lg leading-none font-semibold tracking-tight">
            {stock.symbol}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1.5 truncate text-xs text-muted-foreground">
            {stock.name} · {stock.sector}
          </DialogPrimitive.Description>
        </div>
        <DialogClose
          aria-label={pick("상세 닫기", "Close details")}
          className="-mt-1 -mr-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="size-4" />
        </DialogClose>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {earnings && <div className="mb-5 rounded-xl border border-border p-3 text-sm">
          <p className="font-semibold">{pick("실적 일정", "Earnings schedule")} · {earnings.date} ET</p>
          <p className="mt-1 text-xs text-muted-foreground">{earnings.session === "UNKNOWN" ? pick("시간 미제공", "Time not supplied") : SESSION_LABEL[earnings.session]}{earnings.epsForecast !== null && ` · ${pick("예상 EPS", "Est EPS")} ${earnings.epsForecast}`}</p>
        </div>}
        <div className="flex items-end justify-between gap-3">
          <span className="num text-3xl leading-none font-semibold tracking-tight">
            {formatCurrency(stock.price)}
          </span>
          <div className="flex flex-col items-end gap-1.5">
            <ChangePill value={stock.changePercent} />
            <span className="num text-[11px] text-muted-foreground">
              {formatSignedNumber(stock.changeAbsolute)} {pick("오늘", "today")}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="label-xs">{pick("밴드 위치", "Position in band")}</span>
            <span className="num state-tint text-sm font-semibold">
              {formatSigma(stock.zScore)}
            </span>
          </div>
          <SigmaRangeBar
            zScore={stock.zScore}
            status={stock.status}
            variant="detailed"
            prices={{
              lowerExtreme: stock.sigmaExtremeLower,
              lower1: stock.sigma1Lower,
              anchor: stock.anchor,
              upper1: stock.sigma1Upper,
              upperExtreme: stock.sigmaExtremeUpper,
            }}
          />
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-border/70 bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)] p-3">
          <StatusBadge status={stock.status} className="mt-px shrink-0" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {meta.description}
          </p>
        </div>

        <div className="mt-6">
          {stock.gex ? (
            <div className="flex items-center gap-1 rounded-full border border-border/70 p-1">
              <ViewTab
                label="Options GEX"
                active={view === "GEX"}
                onClick={() => setView("GEX")}
              />
              <ViewTab
                label={stock.intraday ? pick("오늘 가격", "Price today") : pick("가격 경로", "Price path")}
                active={view === "BAND"}
                onClick={() => setView("BAND")}
              />
            </div>
          ) : (
            <span className="label-xs">
              {stock.intraday
                ? pick("오늘 가격 vs 밴드", "Price today vs band")
                : pick(`가격 경로 vs 밴드 · 최근 ${stock.history.length}개 세션`, `Price path vs band · last ${stock.history.length} sessions`)}
            </span>
          )}

          <div className="mt-3">
            {view === "GEX" && stock.gex ? (
              <GexPanel stock={stock} />
            ) : (
              <PriceChart stock={stock} />
            )}
          </div>
        </div>

        {/* The panel is the only way into a symbol from the board, so it also
            has to be the way out to that symbol's own page. */}
        <Link
          href={`/symbol/${stock.symbol}`}
          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-full border border-border/80 px-3.5 text-xs font-medium transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {pick(`${stock.symbol} 페이지 열기`, `Open ${stock.symbol} page`)}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-0 border-t border-border/70">
          <Row label={pick("앵커", "Anchor")} value={formatCurrency(stock.anchor)} />
          <Row
            label="1σ"
            value={`${formatCurrency(stock.standardDeviation)} · ${stock.sigmaPercent.toFixed(2)}%`}
          />
          <Row label="+1σ" value={formatCurrency(stock.sigma1Upper)} accent />
          <Row label="−1σ" value={formatCurrency(stock.sigma1Lower)} accent />
          <Row label="+1.5σ" value={formatCurrency(stock.sigmaExtremeUpper)} accent />
          <Row label="−1.5σ" value={formatCurrency(stock.sigmaExtremeLower)} accent />
          <Row label={pick("전일 마감", "Previous close")} value={formatCurrency(stock.previousClose)} />
          <Row label={pick("일일 등락", "Day change")} value={formatPercent(stock.changePercent)} />
        </dl>
      </div>
    </div>
  );
}

function ViewTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "bg-[color-mix(in_oklch,var(--foreground)_8%,transparent)] text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2.5">
      <dt
        className={cn(
          "num text-[11px]",
          accent ? "text-muted-foreground" : "text-muted-foreground/80",
        )}
      >
        {label}
      </dt>
      <dd className="num text-xs font-medium">{value}</dd>
    </div>
  );
}
