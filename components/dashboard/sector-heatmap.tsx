"use client";

import { formatPercent, formatSigma } from "@/lib/format";
import { BAND_LIMIT, bandPosition, statusStyle } from "@/lib/sigma";
import type { SectorEtfData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SectorHeatmapProps {
  etfs: SectorEtfData[];
  onSelect: (symbol: string) => void;
}

export function SectorHeatmap({ etfs, onSelect }: SectorHeatmapProps) {
  const ordered = [...etfs].sort((a, b) => b.zScore - a.zScore);

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {ordered.map((etf) => {
        // Intensity tracks distance from the anchor, not direction — hue already
        // carries direction, so this stays a two-tone map, not a rainbow.
        const intensity = Math.min(Math.abs(etf.zScore) / BAND_LIMIT, 1);
        const fill = 4 + intensity * 20;
        // Edge floor keeps the quietest tile at least as defined as a plain card.
        const edge = 20 + intensity * 30;

        return (
          <button
            key={etf.symbol}
            type="button"
            onClick={() => onSelect(etf.symbol)}
            style={{
              ...statusStyle(etf.status),
              backgroundColor: `color-mix(in oklch, var(--state) ${fill}%, transparent)`,
              borderColor: `color-mix(in oklch, var(--state) ${edge}%, transparent)`,
            }}
            className={cn(
              "group relative flex aspect-[5/4] cursor-pointer flex-col justify-between rounded-2xl border p-3.5 text-left backdrop-blur-md transition-all duration-200",
              "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-30px_var(--state)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="num text-[13px] leading-none font-semibold">
                  {etf.symbol}
                </div>
                <div className="mt-1.5 truncate text-[10px] leading-tight text-muted-foreground">
                  {etf.sectorLabel}
                </div>
              </div>
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 size-1.5 shrink-0 rounded-full bg-[var(--state)]",
                  etf.status === "NORMAL" && "opacity-40",
                )}
              />
            </div>

            <div>
              <div
                className={cn(
                  "num text-lg leading-none font-semibold",
                  etf.status === "NORMAL" ? "text-foreground/80" : "state-tint",
                )}
              >
                {formatSigma(etf.zScore)}
              </div>
              <div
                className={cn(
                  "num mt-1.5 text-[11px]",
                  etf.changePercent > 0
                    ? "text-up"
                    : etf.changePercent < 0
                      ? "text-down"
                      : "text-muted-foreground",
                )}
              >
                {formatPercent(etf.changePercent)}
              </div>

              <div className="mt-2.5 h-0.5 w-full rounded-full bg-[color-mix(in_oklch,var(--foreground)_10%,transparent)]">
                <span
                  className="block size-0.5 -translate-x-1/2 rounded-full bg-[var(--state)] ring-2 ring-[color-mix(in_oklch,var(--state)_30%,transparent)]"
                  style={{ marginLeft: `${bandPosition(etf.zScore)}%` }}
                />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
