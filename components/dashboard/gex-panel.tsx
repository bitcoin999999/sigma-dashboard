"use client";

import * as React from "react";

import { formatCompact, formatCurrency } from "@/lib/format";
import type { GexLevel, StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Row height of one strike in the profile, in px. */
const ROW = 15;
/** Width of the strike column, in px. Fixed so the ladder scans vertically. */
const GUTTER = 44;

/**
 * Dealer gamma exposure by strike.
 *
 * Read it as a hedging map, not a forecast. Where net GEX is positive the
 * dealer is long gamma and sells strength / buys weakness, which damps movement
 * — that is what makes those strikes act like support or resistance. Where it
 * is negative the hedge runs the other way and amplifies the move, so the level
 * is a risk of acceleration rather than a floor.
 *
 * Because of that, the colour scale here is deliberately NOT the red/green used
 * for price change elsewhere on the page: positive GEX is not bullish, it is
 * just sticky. Blue = cushion, red = acceleration.
 */
export function GexPanel({ stock }: { stock: StockData }) {
  const gex = stock.gex;
  if (!gex) return null;

  const spot = stock.price;
  const profile = gex.profile;

  // Bars are scaled against the largest absolute value on screen, not against
  // the symbol's all-strike maximum — otherwise a far-OTM crash-hedge spike
  // flattens every bar in the range that is actually being traded.
  const scale = Math.max(...profile.map((row) => Math.abs(row.netGex)), 1);

  // The strike price sits between, so highlight the one it is closest to.
  const atmStrike = profile.reduce((closest, row) =>
    Math.abs(row.strike - spot) < Math.abs(closest.strike - spot)
      ? row
      : closest,
  ).strike;

  const longGamma = gex.dealer === "LONG_GAMMA";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "rounded-md px-2 py-1 text-[10px] font-semibold tracking-[0.06em] uppercase",
            longGamma
              ? "bg-[color-mix(in_oklch,var(--primary)_16%,transparent)] text-[var(--primary)]"
              : "bg-[color-mix(in_oklch,var(--sigma-hot)_16%,transparent)] text-[var(--sigma-hot)]",
          )}
        >
          Dealer {longGamma ? "long gamma" : "short gamma"}
        </span>
        <span className="num text-[11px] text-muted-foreground">
          Net {formatCompact(gex.netGamma)} · OI {gex.asOf}
        </span>
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        {longGamma
          ? "Hedging leans against the move, so the strikes below tend to hold."
          : "Hedging runs with the move, so levels break faster than they hold."}
      </p>

      <div className="relative mt-4" style={{ height: profile.length * ROW }}>
        {/* Zero axis, drawn once across the track so it reads as one line
            rather than 24 stacked segments. `GUTTER` keeps it clear of the
            strike column. */}
        <div
          className="absolute inset-y-0 w-px bg-border"
          style={{ left: `calc(${GUTTER}px + (100% - ${GUTTER}px) / 2)` }}
        />

        {[...profile].reverse().map((row, index) => (
          <StrikeRow
            key={row.strike}
            row={row}
            top={index * ROW}
            scale={scale}
            atm={row.strike === atmStrike}
          />
        ))}

        <SpotLine profile={profile} spot={spot} />
      </div>

      <div
        className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground/80"
        style={{ marginLeft: GUTTER }}
      >
        <span>← accelerates</span>
        <span>cushions →</span>
      </div>

      <dl className="mt-5 space-y-px border-t border-border/70 pt-1">
        <LevelRow
          label="Resistance"
          hint="+GEX above spot"
          levels={gex.resistance}
          tone="cushion"
        />
        <LevelRow
          label="Support"
          hint="+GEX below spot"
          levels={gex.support}
          tone="cushion"
        />
        <LevelRow
          label="Acceleration"
          hint="−GEX, breaks fast"
          levels={gex.acceleration}
          tone="risk"
        />
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="num text-[11px] text-muted-foreground">Gamma flip</dt>
          <dd className="num text-xs font-medium">
            {gex.zeroGamma === null ? (
              <span className="text-muted-foreground">none in range</span>
            ) : (
              formatCurrency(gex.zeroGamma)
            )}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/80">
        All expirations, strikes within ±10% of spot. Open interest settles once
        a day, so these levels move on the same cadence as the σ band.
      </p>
    </div>
  );
}

function StrikeRow({
  row,
  top,
  scale,
  atm,
}: {
  row: GexLevel;
  top: number;
  scale: number;
  atm: boolean;
}) {
  const positive = row.netGex >= 0;
  // Each half of the track is 50%; back off slightly so the widest bar stops
  // short of the edge instead of butting against it.
  const width = (Math.abs(row.netGex) / scale) * 47;

  return (
    <div
      className="absolute inset-x-0 flex items-center"
      style={{ top, height: ROW }}
      title={`${row.strike} · ${formatCompact(row.netGex)} net GEX`}
    >
      <span
        className={cn(
          "num shrink-0 pr-2 text-right text-[9px] leading-none",
          atm ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
        style={{ width: GUTTER }}
      >
        {row.strike}
      </span>

      <div className="relative h-[9px] flex-1">
        <div
          className="absolute h-full rounded-[2px]"
          style={{
            left: positive ? "50%" : `${50 - width}%`,
            width: `${width}%`,
            backgroundColor: positive
              ? "color-mix(in oklch, var(--primary) 65%, transparent)"
              : "color-mix(in oklch, var(--sigma-hot) 60%, transparent)",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Spot marker, positioned between the two strikes that bracket it.
 *
 * Strikes are unevenly spaced and the rows are not a linear price axis, so the
 * line is placed by interpolating between neighbouring rows rather than by
 * price. It marks where price sits in the ladder, nothing more.
 */
function SpotLine({ profile, spot }: { profile: GexLevel[]; spot: number }) {
  // Rows render high strike first, so index 0 is the top of the ladder.
  const descending = [...profile].reverse();

  const below = descending.findIndex((row) => row.strike <= spot);
  if (below === -1) return null;
  if (below === 0) return null;

  const upper = descending[below - 1];
  const lower = descending[below];
  const span = upper.strike - lower.strike;
  const fraction = span > 0 ? (upper.strike - spot) / span : 0.5;
  const top = (below - 1 + fraction) * ROW + ROW / 2;

  return (
    <div
      className="pointer-events-none absolute right-0 flex items-center gap-1.5"
      style={{ top, left: GUTTER, transform: "translateY(-50%)" }}
    >
      <div className="h-px flex-1 bg-[color-mix(in_oklch,var(--foreground)_40%,transparent)]" />
      {/* Opaque, not translucent: this label lands on top of a bar whenever
          spot sits near a heavily traded strike, which is most of the time. */}
      <span className="num rounded-[3px] bg-[var(--background)] px-1 py-px text-[9px] leading-none font-semibold">
        {formatCurrency(spot)}
      </span>
      <div className="h-px flex-1 bg-[color-mix(in_oklch,var(--foreground)_40%,transparent)]" />
    </div>
  );
}

function LevelRow({
  label,
  hint,
  levels,
  tone,
}: {
  label: string;
  hint: string;
  levels: GexLevel[];
  tone: "cushion" | "risk";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2.5">
      <dt className="min-w-0">
        <span className="num text-[11px] text-muted-foreground">{label}</span>
        <span className="ml-1.5 text-[10px] text-muted-foreground/70">
          {hint}
        </span>
      </dt>
      <dd className="num flex shrink-0 items-baseline gap-2 text-xs font-medium">
        {levels.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          levels.map((level) => (
            <span
              key={level.strike}
              className={
                tone === "cushion"
                  ? "text-[var(--primary)]"
                  : "text-[var(--sigma-hot)]"
              }
            >
              {formatCurrency(level.strike)}
            </span>
          ))
        )}
      </dd>
    </div>
  );
}
