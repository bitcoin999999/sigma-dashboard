import { findGexFloor, MIN_DOMINANCE, MIN_SHARE } from "./gex-floor";
import type { GexLevel, GexProfile, StockData } from "./types";

export type GexRole = "support" | "resistance";
export interface GexChartLevel {
  id: string;
  role: GexRole;
  rank: number;
  price: number;
  netGex: number;
  sharePercent: number | null;
  dominance: number | null;
  strong: boolean;
  oiAsOf: string;
}
export interface GexChartOptions {
  maxPerSide?: 1 | 2;
  minSharePercent?: number;
  minDominance?: number;
}
function normalize(levels: readonly GexLevel[]): GexLevel[] {
  const byStrike = new Map<number, GexLevel>();
  for (const level of levels) {
    if (!level || !Number.isFinite(level.strike) || level.strike <= 0 ||
        !Number.isFinite(level.netGex) || level.netGex <= 0) continue;
    const previous = byStrike.get(level.strike);
    if (!previous || level.netGex > previous.netGex) byStrike.set(level.strike, { ...level });
  }
  return [...byStrike.values()].sort((a, b) => b.netGex - a.netGex || a.strike - b.strike);
}
export function selectGexChartLevels(gex: GexProfile | undefined, options: GexChartOptions = {}): GexChartLevel[] {
  if (!gex) return [];
  const oiAsOf = gex.asOf;
  const { maxPerSide = 1, minSharePercent = MIN_SHARE, minDominance = MIN_DOMINANCE } = options;
  const support = normalize(gex.support ?? []), resistance = normalize(gex.resistance ?? []);
  const profile = normalize(gex.profile ?? []);
  const byStrike = new Map(profile.map((level) => [level.strike, level.netGex]));
  const total = profile.reduce((sum, level) => sum + level.netGex, 0);
  const supportStrikes = new Set(support.map((level) => level.strike));
  const conflicts = new Set(resistance.filter((level) => supportStrikes.has(level.strike)).map((level) => level.strike));
  function side(role: GexRole, candidates: GexLevel[]): GexChartLevel[] {
    const clean = candidates.filter((level) => !conflicts.has(level.strike));
    return clean.slice(0, maxPerSide).map((level, index) => {
      const value = byStrike.get(level.strike);
      const comparable = Number.isFinite(total) && total > 0 && value !== undefined &&
        Math.abs(value - level.netGex) <= Math.max(1, Math.abs(value), Math.abs(level.netGex)) * 1e-8;
      const sharePercent = comparable ? value! / total * 100 : null;
      const next = clean[index + 1];
      const ratio = next ? level.netGex / next.netGex : null;
      const dominance = ratio !== null && Number.isFinite(ratio) ? ratio : null;
      return {
        id: `gex-${role}-${level.strike}`, role, rank: index + 1, price: level.strike, netGex: level.netGex,
        sharePercent, dominance, oiAsOf,
        strong: index === 0 && sharePercent !== null && sharePercent >= minSharePercent &&
          (!next || (dominance !== null && dominance >= minDominance)),
      };
    });
  }
  return [...side("support", support), ...side("resistance", resistance)];
}

export interface GexChartSnapshot {
  weekStart: string;
  oiAsOf: string;
  levels: GexChartLevel[];
  floorStrike: number | null;
  floorWeekStart: string;
}
export function buildGexChartSnapshot(stock: StockData, weekStart: string, floorWeekStart: string): GexChartSnapshot | null {
  if (!stock.gex) return null;
  return { weekStart, floorWeekStart, oiAsOf: stock.gex.asOf,
    levels: selectGexChartLevels(stock.gex, { maxPerSide: 2 }),
    floorStrike: findGexFloor(stock)?.strike ?? null };
}

/** Only labels move. All price lines continue to use the original axis transform. */
export function separatePriceLabels<T extends { value: number }>(levels: T[], y: (price: number) => number, top: number, bottom: number) {
  const gap = 22;
  const sorted = levels.map((level) => ({ ...level, labelY: y(level.value) })).sort((a, b) => a.labelY - b.labelY);
  for (let i = 0; i < sorted.length; i++) sorted[i].labelY = Math.max(sorted[i].labelY, top, i ? sorted[i - 1].labelY + gap : top);
  for (let i = sorted.length - 1; i >= 0; i--) sorted[i].labelY = Math.min(sorted[i].labelY, bottom, i < sorted.length - 1 ? sorted[i + 1].labelY - gap : bottom);
  return sorted;
}
