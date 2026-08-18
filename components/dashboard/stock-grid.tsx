"use client";

import { SearchX } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { StockData } from "@/lib/types";

import { StockCard } from "./stock-card";

interface StockGridProps {
  stocks: StockData[];
  onSelect: (symbol: string) => void;
  loading?: boolean;
  onReset?: () => void;
}

const GRID =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";

export function StockGrid({
  stocks,
  onSelect,
  loading,
  onReset,
}: StockGridProps) {
  if (loading) return <StockGridSkeleton />;
  if (stocks.length === 0) return <EmptyState onReset={onReset} />;

  return (
    <div className={GRID}>
      {stocks.map((stock) => (
        <StockCard key={stock.symbol} stock={stock} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function StockGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="glass space-y-4 p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-14" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-end justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-14 rounded-md" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset?: () => void }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border border-border/70 bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)]">
        <SearchX className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-medium">No symbols match</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try a different ticker, or widen the sigma filter.
        </p>
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-1 rounded-full border border-border/80 px-3 py-1.5 text-xs font-medium transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Reset filters
        </button>
      )}
    </div>
  );
}
