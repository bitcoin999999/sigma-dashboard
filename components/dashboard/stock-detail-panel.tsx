"use client";

import { X } from "lucide-react";

import { Dialog, DialogClose, DialogPortal } from "@/components/ui/dialog";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  formatCurrency,
  formatPercent,
  formatSigma,
  formatSignedNumber,
} from "@/lib/format";
import { STATUS_META, statusStyle } from "@/lib/sigma";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ChangePill } from "./change-pill";
import { PriceChart } from "./price-chart";
import { SigmaRangeBar } from "./sigma-range-bar";
import { StatusBadge } from "./status-badge";

interface StockDetailPanelProps {
  stock: StockData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockDetailPanel({
  stock,
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
          {stock && <DetailContent stock={stock} />}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

function DetailContent({ stock }: { stock: StockData }) {
  const meta = STATUS_META[stock.status];

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
          aria-label="Close details"
          className="-mt-1 -mr-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X className="size-4" />
        </DialogClose>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="flex items-end justify-between gap-3">
          <span className="num text-3xl leading-none font-semibold tracking-tight">
            {formatCurrency(stock.price)}
          </span>
          <div className="flex flex-col items-end gap-1.5">
            <ChangePill value={stock.changePercent} />
            <span className="num text-[11px] text-muted-foreground">
              {formatSignedNumber(stock.changeAbsolute)} today
            </span>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="label-xs">Position in band</span>
            <span className="num state-tint text-sm font-semibold">
              {formatSigma(stock.zScore)}
            </span>
          </div>
          <SigmaRangeBar
            zScore={stock.zScore}
            status={stock.status}
            variant="detailed"
          />
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-border/70 bg-[color-mix(in_oklch,var(--foreground)_3%,transparent)] p-3">
          <StatusBadge status={stock.status} className="mt-px shrink-0" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {meta.description}
          </p>
        </div>

        <div className="mt-6">
          <span className="label-xs">
            Price path vs band · last {stock.history.length} sessions
          </span>
          <div className="mt-2">
            <PriceChart stock={stock} />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-0 border-t border-border/70">
          <Row label="Anchor" value={formatCurrency(stock.anchor)} />
          <Row
            label="1σ"
            value={`${formatCurrency(stock.standardDeviation)} · ${stock.sigmaPercent.toFixed(2)}%`}
          />
          <Row label="+1σ" value={formatCurrency(stock.sigma1Upper)} accent />
          <Row label="−1σ" value={formatCurrency(stock.sigma1Lower)} accent />
          <Row label="+1.5σ" value={formatCurrency(stock.sigmaExtremeUpper)} accent />
          <Row label="−1.5σ" value={formatCurrency(stock.sigmaExtremeLower)} accent />
          <Row label="Previous close" value={formatCurrency(stock.previousClose)} />
          <Row label="Day change" value={formatPercent(stock.changePercent)} />
        </dl>
      </div>
    </div>
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
