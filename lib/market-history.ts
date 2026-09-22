import { buildWeeklyBand, calculateZScore, sigmaPriceRange, resolveStatus } from "./sigma";
import type { MarketSnapshot, StockData, WeeklyBand } from "./types";
import { bandEndDate, isDate } from "./market-dates";
export interface HistoryBand extends WeeklyBand { endDate: string; observedAt?: string; fromAnchor?: boolean; scaled?: boolean }
export interface MarketHistory { schemaVersion: 1; symbol: string; generatedAt: string; prices: { date: string; close: number }[]; bands: HistoryBand[] }
export function currentHistory(stock: StockData, snapshot: MarketSnapshot): MarketHistory {
  const bands: HistoryBand[] = [stock.weekBeforeLast, stock.lastWeek].flatMap(b => b ? [{ ...b, endDate: b.closes.at(-1)?.date ?? bandEndDate(b.anchorDate) }] : []);
  bands.push({ ...stock.sigmaBasis, anchorDate: snapshot.bandAnchorDate, endDate: snapshot.bandEndDate ?? bandEndDate(snapshot.bandAnchorDate), anchor: stock.anchor, sigmaPercent: stock.sigmaPercent, closes: stock.history.filter(p => p.date > snapshot.bandAnchorDate && p.date <= snapshot.sessionDate) });
  return { schemaVersion: 1, symbol: stock.symbol, generatedAt: snapshot.generatedAt, prices: stock.history, bands };
}
export function validMarketHistory(value: unknown, symbol: string): value is MarketHistory {
  const v = value as MarketHistory;
  const positive = (n: number) => Number.isFinite(n) && n > 0;
  return !!v && v.schemaVersion === 1 && v.symbol === symbol && typeof v.generatedAt === "string" &&
    Array.isArray(v.prices) && v.prices.length <= 10000 && v.prices.every(p => isDate(p.date) && positive(p.close)) &&
    Array.isArray(v.bands) && v.bands.length <= 1000 && v.bands.every(b => isDate(b.anchorDate) && isDate(b.endDate) && b.endDate > b.anchorDate && positive(b.anchor) && positive(b.sigmaPercent) && Array.isArray(b.closes) && b.closes.every(p => isDate(p.date) && p.date > b.anchorDate && p.date <= b.endDate && positive(p.close)));
}
export function mergeMarketHistory(archive: MarketHistory | null, current: MarketHistory): MarketHistory {
  const prices = new Map((archive?.prices ?? []).map(p => [p.date,p]));
  current.prices.forEach(p => prices.set(p.date,p));
  const bands = new Map((archive?.bands ?? []).map(b => [b.anchorDate,b]));
  current.bands.forEach(b => bands.set(b.anchorDate, { ...bands.get(b.anchorDate), ...b }));
  const cutoff = current.prices.at(-1)?.date ?? "";
  return { ...current, prices: [...prices.values()].filter(p => p.date <= cutoff).sort((a,b) => a.date.localeCompare(b.date)), bands: [...bands.values()].filter(b => b.anchorDate <= cutoff).sort((a,b) => a.anchorDate.localeCompare(b.anchorDate)) };
}
export function historyChartRows(history: MarketHistory) {
  return history.prices.map(p => {
    // Closing Friday belongs to the band that just finished, never the new zero-sigma band.
    const band = history.bands.find(b => b.fromAnchor === true && p.date > b.anchorDate && p.date <= b.endDate);
    const sd = band ? band.anchor * band.sigmaPercent / 100 : NaN;
    const z = band ? calculateZScore(p.close,band.anchor,sd) : NaN;
    const bounds = band ? sigmaPriceRange(band.anchor,sd,1) : null;
    return { date: p.date, price: p.close, sigma: Number.isFinite(z) ? z : null,
      range: bounds && Number.isFinite(bounds.lower) ? [bounds.lower,bounds.upper] : null,
      anchorDate: band?.anchorDate ?? null, status: resolveStatus(z) };
  });
}
export function weeklyOutcomes(history: MarketHistory, session: string) {
  return history.bands.filter(b => b.fromAnchor === true && b.endDate <= session && b.closes.at(-1)?.date === b.endDate).flatMap(b => {
    const result = buildWeeklyBand(b); if (!result) return [];
    const future = [1,2,4].map(weeks => {
      const end = new Date(`${result.closeDate}T00:00:00Z`);
      // Compare to the target week’s Friday even if the event week closed Thursday.
      end.setUTCDate(end.getUTCDate() + 4 - ((end.getUTCDay()+6)%7) + 7 * weeks);
      const scheduled = end.toISOString().slice(0,10);
      if (scheduled > session) return null;
      // Last session of the target week (Thursday when Friday is a holiday).
      const monday = new Date(end); monday.setUTCDate(end.getUTCDate() - ((end.getUTCDay()+6)%7));
      const settledEnd = history.bands.find(next => next.endDate >= monday.toISOString().slice(0,10) && next.endDate <= scheduled && next.closes.at(-1)?.date === next.endDate)?.endDate;
      // Only a settled source band can establish a holiday close; a missing Friday
      // price must not silently become Thursday's return.
      const p = history.prices.find(p => p.date === (settledEnd ?? scheduled));
      return p ? (p.close / result.close - 1) * 100 : null;
    });
    return [{ ...result, future }];
  }).reverse();
}

export function pricePathAfterClose(history: MarketHistory, closeDate: string, close: number) {
  const limit = new Date(`${closeDate}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 28);
  return history.prices.filter(p => p.date >= closeDate && p.date <= limit.toISOString().slice(0,10))
    .map(p => ({ date: p.date, price: p.close, returnPercent: (p.close / close - 1) * 100 }));
}
