import { selectGexChartLevels } from "./gex-chart-levels";
import { isDate } from "./market-dates";
import type { StockData } from "./types";

/** A display distance, not a validated trading signal or a GEX strength threshold. */
export const GEX_NEAR_SPOT_PERCENT = 1;

export function nearbyGexLevels(stock: StockData, sessionDate: string) {
  const gex = stock.gex;
  if (!gex || !isDate(gex.asOf)) return { state: "unavailable" as const, levels: [] };
  if (gex.asOf !== sessionDate) return { state: "different_session" as const, levels: [], asOf: gex.asOf };
  if (!Number.isFinite(stock.price) || stock.price <= 0) return { state: "unavailable" as const, levels: [] };
  const candidates = selectGexChartLevels(gex, { maxPerSide: 2 })
    .map(level => ({ ...level, distancePercent: (level.price - stock.price) / stock.price * 100 }))
    // Keep the publisher's role. Do not turn a crossed resistance into support.
    .filter(level => (level.role === "support" ? level.price <= stock.price : level.price >= stock.price) &&
      Math.abs(level.distancePercent) <= GEX_NEAR_SPOT_PERCENT)
    .sort((a, b) => Math.abs(a.distancePercent) - Math.abs(b.distancePercent) || a.rank - b.rank);
  // At most one nearby candidate per side keeps the row readable on a phone.
  const levels = candidates.filter((level, index) => candidates.findIndex(item => item.role === level.role) === index);
  return { state: "current" as const, levels, asOf: gex.asOf };
}
