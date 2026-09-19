"use client";

import * as React from "react";

import { useLocale } from "@/components/locale-provider";
import { formatCompact, formatCurrency } from "@/lib/format";
import type { GexLevel, StockData } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Row height of one strike in the profile, in px. */
const ROW = 15;
/** Width of the strike column, in px. Fixed so the ladder scans vertically. */
const GUTTER = 44;

/**
 * The same ladder, sized for a page instead of a side panel.
 *
 * Taller rows because a 15px row is under the thumb target on a phone, a wider
 * strike column because four-digit strikes were clipping, and a value column
 * because the compact panel only carries the net GEX figure in a `title`
 * attribute — which touch has no way to open. Nothing here is extra data: it is
 * the same profile the panel already receives, with the parts that were
 * hover-only or implied made visible.
 */
const DETAIL_ROW = 24;
const DETAIL_GUTTER = 60;
/** Width of the net-GEX column in detailed mode. Zero in the compact panel. */
const DETAIL_VALUE = 56;

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
export function GexPanel({
  stock,
  detailed = false,
}: {
  stock: StockData;
  /**
   * Page layout rather than side-panel layout: bigger rows, the net GEX figure
   * spelled out per strike, and the σ band edges drawn onto the ladder.
   */
  detailed?: boolean;
}) {
  const { pick } = useLocale();
  const gex = stock.gex;
  // An empty profile would take `reduce` below with no seed, which throws.
  if (!gex || gex.profile.length === 0) return null;

  const spot = stock.price;
  const profile = gex.profile;
  const row = detailed ? DETAIL_ROW : ROW;
  const gutter = detailed ? DETAIL_GUTTER : GUTTER;
  const value = detailed ? DETAIL_VALUE : 0;

  // The publisher sends the 24 strikes nearest spot, so on a symbol with tight
  // strike spacing the σ edges can fall outside the window entirely — true for
  // about a third of the board. Saying so is the difference between a limit and
  // a missing feature: without it the note promises dashed lines that never
  // appear.
  const lowStrike = profile[0].strike;
  const highStrike = profile[profile.length - 1].strike;
  const offWindow = detailed
    ? [
        stock.sigma1Upper > highStrike
          ? `+1σ ${formatCurrency(stock.sigma1Upper)}`
          : null,
        stock.sigma1Lower < lowStrike
          ? `−1σ ${formatCurrency(stock.sigma1Lower)}`
          : null,
      ].filter((entry): entry is string => entry !== null)
    : [];

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
          ? pick("헤지가 가격 방향과 반대로 작용해 아래 행사가가 지지되는 경향이 있습니다.", "Hedging leans against the move, so the strikes below tend to hold.")
          : pick("헤지가 가격 방향을 따라가 지지보다 이탈이 빨라질 수 있습니다.", "Hedging runs with the move, so levels break faster than they hold.")}
      </p>

      <div className="relative mt-4" style={{ height: profile.length * row }}>
        {/* Zero axis, drawn once across the track so it reads as one line
            rather than 24 stacked segments. The gutter and the value column
            keep it clear of the figures on either side. */}
        <div
          className="absolute inset-y-0 w-px bg-border"
          style={{
            left: `calc(${gutter}px + (100% - ${gutter + value}px) / 2)`,
          }}
        />

        {[...profile].reverse().map((level, index) => (
          <StrikeRow
            key={level.strike}
            row={level}
            top={index * row}
            height={row}
            gutter={gutter}
            valueWidth={value}
            scale={scale}
            atm={level.strike === atmStrike}
          />
        ))}

        {/* The σ edges on the gamma ladder. Which strikes the week's expected
            move actually reaches is the question this page exists to answer,
            and until now it had to be carried between two views in the
            reader's head. Skipped silently when an edge falls outside the
            published strike window. */}
        {detailed && (
          <>
            <LadderMarker
              profile={profile}
              price={stock.sigma1Upper}
              rowHeight={row}
              gutter={gutter}
              label="+1σ"
              tone="band"
            />
            <LadderMarker
              profile={profile}
              price={stock.sigma1Lower}
              rowHeight={row}
              gutter={gutter}
              label="−1σ"
              tone="band"
            />
          </>
        )}

        <LadderMarker
          profile={profile}
          price={spot}
          rowHeight={row}
          gutter={gutter}
          label={formatCurrency(spot)}
          tone="spot"
        />
      </div>

      <div
        className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground/80"
        style={{ marginLeft: gutter, marginRight: value }}
      >
        <span>← {pick("가속", "accelerates")}</span>
        <span>{pick("완충", "cushions")} →</span>
      </div>

      {offWindow.length > 0 && (
        <p className="num mt-2.5 text-[10px] leading-relaxed text-muted-foreground/70">
          {offWindow.join(" · ")} —{" "}
          {pick(
            `공개된 행사가 구간(${formatCurrency(lowStrike)}–${formatCurrency(highStrike)}) 밖이라 위 사다리에는 그려지지 않습니다.`,
            `outside the published strike window (${formatCurrency(lowStrike)}–${formatCurrency(highStrike)}), so not drawn on the ladder above.`,
          )}
        </p>
      )}

      <dl className="mt-5 space-y-px border-t border-border/70 pt-1">
        <LevelRow
          label={pick("저항", "Resistance")}
          hint={pick("현재가 위 +GEX", "+GEX above spot")}
          levels={gex.resistance}
          tone="cushion"
        />
        <LevelRow
          label={pick("지지", "Support")}
          hint={pick("현재가 아래 +GEX", "+GEX below spot")}
          levels={gex.support}
          tone="cushion"
        />
        <LevelRow
          label={pick("가속", "Acceleration")}
          hint={pick("−GEX, 이탈 가속", "−GEX, breaks fast")}
          levels={gex.acceleration}
          tone="risk"
        />
        <div className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="num text-[11px] text-muted-foreground">Gamma flip</dt>
          <dd className="num text-xs font-medium">
            {gex.zeroGamma === null ? (
              <span className="text-muted-foreground">{pick("범위 내 없음", "none in range")}</span>
            ) : (
              formatCurrency(gex.zeroGamma)
            )}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground/80">
        {pick("전체 만기, 현재가 ±10% 내 행사가 기준입니다. Open interest는 하루에 한 번 확정되므로 이 레벨도 σ 밴드와 같은 주기로 변합니다.", "All expirations, strikes within ±10% of spot. Open interest settles once a day, so these levels move on the same cadence as the σ band.")}
      </p>
    </div>
  );
}

function StrikeRow({
  row,
  top,
  height,
  gutter,
  valueWidth,
  scale,
  atm,
}: {
  row: GexLevel;
  top: number;
  height: number;
  gutter: number;
  valueWidth: number;
  scale: number;
  atm: boolean;
}) {
  const positive = row.netGex >= 0;
  // Each half of the track is 50%; back off slightly so the widest bar stops
  // short of the edge instead of butting against it.
  const width = (Math.abs(row.netGex) / scale) * 47;
  const detailed = valueWidth > 0;

  return (
    <div
      className="absolute inset-x-0 flex items-center"
      style={{ top, height }}
      title={`${row.strike} · ${formatCompact(row.netGex)} net GEX`}
    >
      <span
        className={cn(
          "num shrink-0 pr-2 text-right leading-none",
          detailed ? "text-[11px]" : "text-[9px]",
          atm ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
        style={{ width: gutter }}
      >
        {row.strike}
      </span>

      <div
        className="relative flex-1"
        style={{ height: detailed ? 13 : 9 }}
      >
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

      {/* The figure the compact panel only ever put in a `title`, which a
          touch device cannot open. */}
      {detailed && (
        <span
          className={cn(
            "num shrink-0 pl-2 text-right text-[10px] leading-none tabular-nums",
            positive ? "text-[var(--primary)]" : "text-[var(--sigma-hot)]",
          )}
          style={{ width: valueWidth }}
        >
          {formatCompact(row.netGex)}
        </span>
      )}
    </div>
  );
}

/**
 * A price drawn across the ladder, positioned between the two strikes that
 * bracket it.
 *
 * Strikes are unevenly spaced and the rows are not a linear price axis, so the
 * line is placed by interpolating between neighbouring rows rather than by
 * price. It marks where a price sits *in the ladder*, nothing more — which is
 * also why a price outside the published strike window draws nothing instead of
 * being clamped to an edge it never reached.
 */
function LadderMarker({
  profile,
  price,
  rowHeight,
  gutter,
  label,
  tone,
}: {
  profile: GexLevel[];
  price: number;
  rowHeight: number;
  gutter: number;
  label: string;
  tone: "spot" | "band";
}) {
  // Rows render high strike first, so index 0 is the top of the ladder.
  const descending = [...profile].reverse();

  const below = descending.findIndex((row) => row.strike <= price);
  if (below === -1) return null;
  if (below === 0) return null;

  const upper = descending[below - 1];
  const lower = descending[below];
  const span = upper.strike - lower.strike;
  const fraction = span > 0 ? (upper.strike - price) / span : 0.5;
  const top = (below - 1 + fraction) * rowHeight + rowHeight / 2;

  const spot = tone === "spot";
  const rule = spot
    ? "h-px flex-1 bg-[color-mix(in_oklch,var(--foreground)_40%,transparent)]"
    : "h-0 flex-1 border-t border-dashed border-[color-mix(in_oklch,var(--gex-support,var(--primary))_55%,transparent)]";

  return (
    <div
      className="pointer-events-none absolute right-0 flex items-center gap-1.5"
      style={{ top, left: gutter, transform: "translateY(-50%)" }}
    >
      <div className={rule} />
      {/* Opaque, not translucent: this label lands on top of a bar whenever
          the price sits near a heavily traded strike, which is most of the
          time. */}
      <span
        className={cn(
          "num rounded-[3px] bg-[var(--background)] px-1 py-px text-[9px] leading-none font-semibold",
          !spot && "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <div className={rule} />
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
