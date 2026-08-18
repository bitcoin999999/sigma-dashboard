"use client";

import { formatCurrency, formatSigma } from "@/lib/format";
import { statusStyle } from "@/lib/sigma";
import type { SectorEtfData } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ChangePill } from "./change-pill";
import { SIGMA } from "./sigma-glyph";
import { SigmaRangeBar } from "./sigma-range-bar";
import { StatusBadge } from "./status-badge";

interface SectorEtfMonitorProps {
  etfs: SectorEtfData[];
  onSelect: (symbol: string) => void;
}

export function SectorEtfMonitor({ etfs, onSelect }: SectorEtfMonitorProps) {
  return (
    <div className="glass overflow-hidden">
      {/* Dense table on wide screens — this section is reference data. */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <thead>
          <tr className="border-b border-border/70">
            <Th className="pl-5 text-left">Symbol</Th>
            <Th className="text-right">Price</Th>
            <Th className="text-right">Change</Th>
            <Th className="text-right">Anchor</Th>
            <Th className="hidden text-right lg:table-cell">−1.5{SIGMA}</Th>
            <Th className="hidden text-right lg:table-cell">−1{SIGMA}</Th>
            <Th className="hidden text-right lg:table-cell">+1{SIGMA}</Th>
            <Th className="hidden text-right lg:table-cell">+1.5{SIGMA}</Th>
            <Th className="w-40 text-left">Position</Th>
            <Th className="text-right">Z-Score</Th>
            <Th className="pr-5 text-right">Status</Th>
          </tr>
        </thead>
        <tbody>
          {etfs.map((etf) => (
            <tr
              key={etf.symbol}
              tabIndex={0}
              onClick={() => onSelect(etf.symbol)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(etf.symbol);
                }
              }}
              style={statusStyle(etf.status)}
              className="cursor-pointer border-b border-border/40 transition-colors last:border-b-0 hover:bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] focus-visible:bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <Td className="pl-5">
                <div className="num text-[13px] font-semibold">{etf.symbol}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {etf.sectorLabel}
                </div>
              </Td>
              <Td className="num text-right font-medium">
                {formatCurrency(etf.price)}
              </Td>
              <Td className="text-right">
                <ChangePill value={etf.changePercent} showIcon={false} />
              </Td>
              <Td className="num text-right text-muted-foreground">
                {formatCurrency(etf.anchor)}
              </Td>
              <Td className="num hidden text-right text-muted-foreground/70 lg:table-cell">
                {formatCurrency(etf.sigmaExtremeLower)}
              </Td>
              <Td className="num hidden text-right text-muted-foreground/70 lg:table-cell">
                {formatCurrency(etf.sigma1Lower)}
              </Td>
              <Td className="num hidden text-right text-muted-foreground/70 lg:table-cell">
                {formatCurrency(etf.sigma1Upper)}
              </Td>
              <Td className="num hidden text-right text-muted-foreground/70 lg:table-cell">
                {formatCurrency(etf.sigmaExtremeUpper)}
              </Td>
              <Td>
                <SigmaRangeBar zScore={etf.zScore} status={etf.status} />
              </Td>
              <Td
                className={cn(
                  "num text-right font-semibold",
                  etf.status === "NORMAL" ? "text-foreground/75" : "state-tint",
                )}
              >
                {formatSigma(etf.zScore)}
              </Td>
              <Td className="pr-5 text-right">
                <StatusBadge status={etf.status} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-border/50 md:hidden">
        {etfs.map((etf) => (
          <li key={etf.symbol}>
            <button
              type="button"
              onClick={() => onSelect(etf.symbol)}
              style={statusStyle(etf.status)}
              className="w-full p-4 text-left transition-colors hover:bg-[color-mix(in_oklch,var(--foreground)_4%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="num text-[13px] font-semibold">
                    {etf.symbol}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {etf.sectorLabel}
                  </div>
                </div>
                <StatusBadge status={etf.status} />
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="num text-lg leading-none font-semibold">
                  {formatCurrency(etf.price)}
                </span>
                <ChangePill value={etf.changePercent} />
              </div>

              <div className="mt-3.5">
                <SigmaRangeBar zScore={etf.zScore} status={etf.status} />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="num text-[11px] text-muted-foreground/80">
                  {formatCurrency(etf.sigma1Lower)} –{" "}
                  {formatCurrency(etf.sigma1Upper)}
                </span>
                <span
                  className={cn(
                    "num text-xs font-semibold",
                    etf.status === "NORMAL"
                      ? "text-foreground/75"
                      : "state-tint",
                  )}
                >
                  {formatSigma(etf.zScore)}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Th({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "label-xs px-3 py-3 font-normal whitespace-nowrap",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <td className={cn("px-3 py-3 align-middle whitespace-nowrap", className)}>
      {children}
    </td>
  );
}
