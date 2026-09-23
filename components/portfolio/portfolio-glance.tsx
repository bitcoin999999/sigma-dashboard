"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { usePortfolio } from "@/hooks/use-portfolio";
import { formatCurrency, formatPercent, formatSigma } from "@/lib/format";
import { valuePositions } from "@/lib/portfolio";
import type { StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One line of the portfolio on the home page. Renders nothing until something is sized. */
export function PortfolioGlance({ stocks, className }: { stocks: StockData[]; className?: string }) {
  const { pick } = useLocale();
  const portfolio = usePortfolio();
  if (!portfolio.ready || portfolio.error) return null;
  const v = valuePositions(portfolio.value.positions, stocks);
  if (v.value === null) return null;
  const tone = v.daily === null ? "text-muted-foreground" : v.daily > 0 ? "text-up" : v.daily < 0 ? "text-down" : "";

  return (
    <Link
      prefetch={false}
      href="/my-sigma/portfolio"
      className={cn("glass group flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring sm:px-5", className)}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{pick("내 포트폴리오", "My portfolio")} · {pick(`${v.pricedCount}종목`, `${v.pricedCount} holdings`)}</p>
        <p className="num mt-1 text-lg font-semibold tracking-tight">{formatCurrency(v.value)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("num text-sm", tone)}>{v.dailyPercent === null ? "—" : formatPercent(v.dailyPercent)} <span className="text-xs text-muted-foreground">{pick("전일 대비", "1D")}</span></p>
        {v.weightedSigma !== null && <p className="num mt-0.5 text-xs text-muted-foreground">{pick("가중 σ", "Weighted σ")} {formatSigma(v.weightedSigma)}</p>}
      </div>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
