import { buildStockData, sigmaPriceRange } from "./sigma";
import type { StockData } from "./types";
import type { WeeklyChartBand } from "./weekly-chart";

/** Supply current and settled weeks without reimplementing the sigma formula. */
export function buildChartBands(stock: StockData, anchorDate: string): WeeklyChartBand[] {
  function band(date: string, data: StockData): WeeklyChartBand {
    const monday = new Date(`${date}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
    const two = sigmaPriceRange(data.anchor, data.standardDeviation, 2);
    return { weekStart: monday.toISOString().slice(0, 10), anchorDate: date, anchor: data.anchor,
      lower: data.sigma1Lower, upper: data.sigma1Upper, lower2: two.lower, upper2: two.upper };
  }
  return [
    band(anchorDate, stock),
    ...[stock.lastWeek, stock.weekBeforeLast].flatMap((week) => week ? [
      band(week.anchorDate, buildStockData({ ...stock, anchor: week.anchor, sigmaPercent: week.sigmaPercent })),
    ] : []),
  ].filter((entry) => Number.isFinite(entry.lower) && Number.isFinite(entry.upper) && entry.upper > entry.lower && entry.lower > 0);
}
