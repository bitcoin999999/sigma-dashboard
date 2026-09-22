import { isDate } from "./market-dates";
import type { StockData } from "./types";

export const PORTFOLIO_KEY = "sigma-personal-portfolios:v1";
export interface Allocation { symbol: string; weight: number }
export interface Holding { symbol: string; quantity: number; averageCost: number; asOf: string }
export interface PortfolioDocument { version: 1; revision: number; allocations: Allocation[]; cashWeight: number; holdings: Holding[] }
export const EMPTY_PORTFOLIO: PortfolioDocument = { version: 1, revision: 0, allocations: [], cashWeight: 100, holdings: [] };
export interface PricePoint { date: string; close: number }
export type PriceHistory = Record<string, PricePoint[]>;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const symbolValid = (s: unknown): s is string => typeof s === "string" && /^[A-Z0-9.^-]{1,20}$/.test(s);
export function parsePortfolio(raw: string): PortfolioDocument {
  const v = JSON.parse(raw) as PortfolioDocument;
  if (!v || v.version !== 1 || !Number.isSafeInteger(v.revision) || v.revision < 0 || !Array.isArray(v.allocations) || !Array.isArray(v.holdings) || v.allocations.length > 20 || v.holdings.length > 20 || !finite(v.cashWeight) || v.cashWeight < 0 || v.cashWeight > 100) throw new Error("Invalid portfolio");
  if (v.allocations.some(r => !r || !symbolValid(r.symbol) || !finite(r.weight) || r.weight < 0 || r.weight > 100) ||
    v.holdings.some(r => !r || !symbolValid(r.symbol) || !finite(r.quantity) || r.quantity <= 0 || !finite(r.averageCost) || r.averageCost <= 0 || !isDate(r.asOf)) ||
    new Set(v.allocations.map(r => r.symbol)).size !== v.allocations.length || new Set(v.holdings.map(r => r.symbol)).size !== v.holdings.length || allocationError(v.allocations, v.cashWeight)) throw new Error("Invalid portfolio");
  return v;
}
export function allocationError(rows: Allocation[], cash: number): string | null {
  if (!finite(cash) || cash < 0 || rows.some(r => !finite(r.weight) || r.weight < 0)) return "invalid_weight";
  return Math.abs(rows.reduce((n,r) => n + r.weight, cash) - 100) > 0.000001 ? "weight_total" : null;
}
export function portfolioHistory(stocks: StockData[]): PriceHistory {
  return Object.fromEntries(stocks.map(stock => [stock.symbol, stock.history]));
}
export type PortfolioPeriod = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";
export const PERIODS: PortfolioPeriod[] = ["1D","1W","1M","3M","YTD","1Y","ALL"];
export function periodStart(dates: string[], period: PortfolioPeriod, end: string): string | null {
  const days = [...new Set(dates.filter(d => d <= end))].sort();
  if (!days.length || days[days.length - 1] !== end) return null;
  if (period === "ALL") return days[0];
  if (period === "1D") return days.at(-2) ?? null;
  const date = new Date(`${end}T00:00:00Z`);
  if (period === "1W") date.setUTCDate(date.getUTCDate() - 7);
  else if (period === "YTD") { date.setUTCMonth(0, 1); date.setUTCDate(0); }
  else { const day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - (period === "1M" ? 1 : period === "3M" ? 3 : 12)); const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth()+1,0)).getUTCDate(); date.setUTCDate(Math.min(day,last)); }
  const boundary = date.toISOString().slice(0,10);
  return days.filter(d => d <= boundary).at(-1) ?? null;
}
export interface ModelPoint { date: string; value: number; returnPercent: number }
export function modelPerformance(rows: Allocation[], cashWeight: number, history: PriceHistory, period: PortfolioPeriod, end: string) {
  const fail = (reason: string) => ({ reason, points: [] as ModelPoint[], returnPercent: null as number | null, dailyPercent: null as number | null, contributions: [] as { symbol: string; contribution: number; endWeight: number }[], start: null as string | null });
  const error = allocationError(rows, cashWeight); if (error) return fail(error);
  const active = rows.filter(r => r.weight > 0);
  if (!active.length) return fail("no_allocation");
  const series = active.map(r => new Map((history[r.symbol] ?? []).filter(p => isDate(p.date) && finite(p.close) && p.close > 0).map(p => [p.date,p.close])));
  if (series.some(s => !s.has(end))) return fail("missing_price");
  const common = [...series[0].keys()].filter(d => series.every(s => s.has(d))).sort();
  const referenceDates = (history.SPY ?? []).filter(p => isDate(p.date) && finite(p.close) && p.close > 0).map(p => p.date);
  const calendar = referenceDates.includes(end) ? referenceDates : common;
  const start = periodStart(period === "ALL" ? common : calendar, period, end); if (!start || !series.every(s=>s.has(start))) return fail("insufficient_history");
  // A missing date inside the requested window is a gap, not zero return or a silent reweight.
  const union = new Set([...calendar,...series.flatMap(s => [...s.keys()])].filter(d => d >= start && d <= end));
  if ([...union].some(d => !series.every(s => s.has(d)))) return fail("history_gap");
  const dates = common.filter(d => d >= start && d <= end);
  const valueAt = (date: string) => cashWeight / 100 + active.reduce((sum,row,i) => sum + row.weight / 100 * series[i].get(date)! / series[i].get(start)!, 0);
  const points = dates.map(date => ({ date, value: valueAt(date), returnPercent: (valueAt(date) - 1) * 100 }));
  const last = points.at(-1)!;
  const prior = points.at(-2);
  return { reason: null, points, start, returnPercent: last.returnPercent,
    dailyPercent: prior ? (last.value / prior.value - 1) * 100 : null,
    contributions: active.map((row,i) => { const ratio = series[i].get(end)! / series[i].get(start)!;
      return { symbol: row.symbol, contribution: row.weight * (ratio - 1), endWeight: row.weight * ratio / last.value }; }) };
}
export function holdingsValuation(holdings: Holding[], stocks: StockData[], sessionDate: string) {
  const bySymbol = new Map(stocks.map(s => [s.symbol,s]));
  const rows = holdings.map(h => {
    const s = bySymbol.get(h.symbol);
    const valid = !!s && finite(s.price) && s.price > 0 && h.asOf <= sessionDate;
    const value = valid ? h.quantity * s.price : null;
    const cost = h.quantity * h.averageCost;
    const previousDate = s?.history.filter(p => p.date < sessionDate).at(-1)?.date;
    const daily = valid && previousDate && h.asOf <= previousDate && finite(s.previousClose) && s.previousClose > 0 ? h.quantity * (s.price - s.previousClose) : null;
    return { ...h, value, cost, profit: value === null ? null : value - cost, daily,
      previousValue: daily === null || value === null ? null : value - daily };
  });
  const complete = rows.length > 0 && rows.every(r => r.value !== null);
  const value = complete ? rows.reduce((sum,r) => sum + r.value!, 0) : null;
  const cost = rows.reduce((sum,r) => sum + r.cost,0);
  const dailyComplete = complete && rows.every(r => r.daily !== null);
  const daily = dailyComplete ? rows.reduce((sum,r) => sum + r.daily!, 0) : null;
  const previous = dailyComplete ? rows.reduce((sum,r) => sum + r.previousValue!,0) : null;
  return { rows, value, cost, profit: value === null ? null : value - cost, returnPercent: value === null || cost <= 0 ? null : (value / cost - 1) * 100,
    daily, dailyPercent: daily === null || !previous ? null : daily / previous * 100, validCount: rows.filter(r => r.value !== null).length };
}
export function quantityFromValue(value: number, price: number): number | null {
  return finite(value) && value > 0 && finite(price) && price > 0 ? value / price : null;
}
