import { isDate } from "./market-dates";
import type { StockData } from "./types";

/** The key predates the v2 document. The document carries its own version. */
export const PORTFOLIO_KEY = "sigma-personal-portfolios:v1";
/** A v1 document is copied here once, before the first v2 write replaces it. */
export const PORTFOLIO_LEGACY_KEY = `${PORTFOLIO_KEY}:legacy`;
export const POSITION_LIMIT = 20;

/**
 * One held symbol. Only the size is entered; value, weight and gain are derived
 * from the snapshot close, so there is nothing else to keep in step.
 */
export interface Position {
  symbol: string;
  /** Shares. null while the row is a constituent without a size yet. */
  quantity: number | null;
  /** USD per share. Optional — it only unlocks the cost-basis figures. */
  averageCost: number | null;
}
export interface PortfolioDocument { version: 2; revision: number; positions: Position[] }
export const EMPTY_PORTFOLIO: PortfolioDocument = { version: 2, revision: 0, positions: [] };
export interface PricePoint { date: string; close: number }
export type PriceHistory = Record<string, PricePoint[]>;

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const optionalPositive = (n: unknown) => n === null || (finite(n) && n > 0);
const symbolValid = (s: unknown): s is string => typeof s === "string" && /^[A-Z0-9.^-]{1,20}$/.test(s);
const invalid = () => { throw new Error("Invalid portfolio"); };

export function parsePortfolio(raw: string): PortfolioDocument {
  const v = JSON.parse(raw);
  if (v?.version === 1) return migrateV1(v);
  if (!v || v.version !== 2 || !Number.isSafeInteger(v.revision) || v.revision < 0 || !Array.isArray(v.positions) || v.positions.length > POSITION_LIMIT) invalid();
  const positions = v.positions as Position[];
  if (positions.some(p => !p || !symbolValid(p.symbol) || !optionalPositive(p.quantity) || !optionalPositive(p.averageCost)) ||
    new Set(positions.map(p => p.symbol)).size !== positions.length) invalid();
  return { version: 2, revision: v.revision, positions: positions.map(({ symbol, quantity, averageCost }) => ({ symbol, quantity, averageCost })) };
}

export function isLegacyPortfolio(raw: string | null): boolean {
  try { return raw !== null && JSON.parse(raw)?.version === 1; } catch { return false; }
}

/**
 * v1 kept start weights and holdings as two unrelated lists. Holdings carry a
 * real size and move over as they are. A weight has no share count behind it,
 * so those symbols come over as unsized rows rather than as invented amounts.
 */
function migrateV1(v: { revision?: unknown; allocations?: unknown; holdings?: unknown }): PortfolioDocument {
  if (!Number.isSafeInteger(v.revision) || !Array.isArray(v.allocations) || !Array.isArray(v.holdings)) invalid();
  const holdings = v.holdings as { symbol: unknown; quantity: unknown; averageCost: unknown; asOf: unknown }[];
  const allocations = v.allocations as { symbol: unknown; weight: unknown }[];
  if (holdings.some(h => !h || !symbolValid(h.symbol) || !finite(h.quantity) || h.quantity <= 0 || !finite(h.averageCost) || h.averageCost <= 0 || !isDate(h.asOf)) ||
    allocations.some(a => !a || !symbolValid(a.symbol) || !finite(a.weight) || a.weight < 0)) invalid();
  const positions = new Map<string, Position>();
  for (const h of holdings) positions.set(h.symbol as string, { symbol: h.symbol as string, quantity: h.quantity as number, averageCost: h.averageCost as number });
  for (const a of allocations) if ((a.weight as number) > 0 && !positions.has(a.symbol as string)) positions.set(a.symbol as string, { symbol: a.symbol as string, quantity: null, averageCost: null });
  return { version: 2, revision: v.revision as number, positions: [...positions.values()].slice(0, POSITION_LIMIT) };
}

export function portfolioHistory(stocks: StockData[]): PriceHistory {
  return Object.fromEntries(stocks.map(stock => [stock.symbol, stock.history]));
}

export interface PositionRow extends Position {
  stock: StockData | null;
  /** quantity × close. null when unsized or the symbol has no close. */
  value: number | null;
  /** Share of the priced total, in %. */
  weight: number | null;
  cost: number | null;
  profit: number | null;
  profitPercent: number | null;
  /** What the last session did to the current size: quantity × (close − previous close). */
  daily: number | null;
}

/**
 * Everything on the page is read off the entered sizes and one snapshot close.
 * A sized symbol without a close is counted as missing, never priced at zero,
 * and the totals say how many rows they cover.
 */
export function valuePositions(positions: Position[], stocks: StockData[]) {
  const bySymbol = new Map(stocks.map(s => [s.symbol, s]));
  const base = positions.map(p => {
    const stock = bySymbol.get(p.symbol) ?? null;
    const price = stock && finite(stock.price) && stock.price > 0 ? stock.price : null;
    const value = price !== null && p.quantity !== null ? p.quantity * price : null;
    const cost = p.quantity !== null && p.averageCost !== null ? p.quantity * p.averageCost : null;
    const profit = value !== null && cost !== null ? value - cost : null;
    const previous = stock?.previousClose;
    const daily = value !== null && finite(previous) && previous > 0 ? p.quantity! * (price! - previous) : null;
    return { ...p, stock, value, cost, profit, profitPercent: profit !== null && cost ? profit / cost * 100 : null, daily };
  });
  const priced = base.filter(r => r.value !== null);
  const value = priced.length ? priced.reduce((n, r) => n + r.value!, 0) : null;
  const rows: PositionRow[] = base.map(r => ({ ...r, weight: r.value !== null && value ? r.value / value * 100 : null }));
  const withDaily = priced.filter(r => r.daily !== null);
  const daily = withDaily.length === priced.length && priced.length ? withDaily.reduce((n, r) => n + r.daily!, 0) : null;
  const withCost = rows.filter(r => r.profit !== null);
  const cost = withCost.reduce((n, r) => n + r.cost!, 0);
  const profit = withCost.length ? withCost.reduce((n, r) => n + r.profit!, 0) : null;
  // Equal to Σ weight × z over the rows that have both. It is a weighted mean of
  // positions inside each symbol's own band, not a portfolio-level sigma.
  const withSigma = rows.filter(r => r.weight !== null && finite(r.stock?.zScore));
  const sigmaWeight = withSigma.reduce((n, r) => n + r.weight!, 0);
  return {
    rows, value, daily,
    dailyPercent: daily !== null && value !== null && value - daily > 0 ? daily / (value - daily) * 100 : null,
    profit, profitPercent: profit !== null && cost > 0 ? profit / cost * 100 : null,
    weightedSigma: sigmaWeight > 0 ? withSigma.reduce((n, r) => n + r.weight! * r.stock!.zScore, 0) / sigmaWeight : null,
    sizedCount: rows.filter(r => r.quantity !== null).length,
    pricedCount: priced.length,
    costCount: withCost.length,
  };
}

export function quantityFromValue(value: number, price: number): number | null {
  return finite(value) && value > 0 && finite(price) && price > 0 ? value / price : null;
}

/**
 * Loose number entry for a phone keyboard: "1,000", "$180.5" and "10주" all read.
 * Empty (or zero) means "no size yet"; anything else unreadable is undefined.
 */
export function parseAmount(text: string): number | null | undefined {
  const cleaned = text.replace(/[,$\s]/g, "").replace(/주$/, "");
  if (cleaned === "") return null;
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return !Number.isFinite(n) ? undefined : n === 0 ? null : n;
}

/**
 * One position per line — `NVDA 10`, `NVDA 10 180.5`, `nvda,10,180`. Commas
 * separate fields here, so thousands separators are not accepted in this box.
 */
export function parsePositionLines(text: string, valid: ReadonlySet<string>) {
  const positions: Position[] = [];
  const rejected: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [symbolText = "", quantityText = "", costText = ""] = line.trim().split(/[\s,;]+/);
    const symbol = symbolText.toUpperCase();
    const quantity = parseAmount(quantityText);
    const averageCost = parseAmount(costText);
    if (!valid.has(symbol) || quantity === undefined || averageCost === undefined) { rejected.push(line.trim()); continue; }
    const existing = positions.findIndex(p => p.symbol === symbol);
    if (existing >= 0) positions.splice(existing, 1);
    positions.push({ symbol, quantity, averageCost });
  }
  return { positions, rejected };
}

/**
 * Adds new symbols at the end and overwrites the size of ones already held.
 * A pasted line without a cost keeps the cost already on file.
 */
export function mergePositions(current: Position[], incoming: Position[]) {
  const next = [...current];
  const added: string[] = [];
  const skipped: string[] = [];
  for (const p of incoming) {
    const index = next.findIndex(r => r.symbol === p.symbol);
    if (index >= 0) next[index] = { ...next[index], quantity: p.quantity ?? next[index].quantity, averageCost: p.averageCost ?? next[index].averageCost };
    else if (next.length < POSITION_LIMIT) { next.push(p); added.push(p.symbol); }
    else skipped.push(p.symbol);
  }
  return { positions: next, added, skipped };
}

export type PortfolioPeriod = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";
export const PERIODS: PortfolioPeriod[] = ["1W","1M","3M","YTD","1Y","ALL"];
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
export type PerformanceFailure = "no_position" | "missing_price" | "insufficient_history" | "history_gap";

/**
 * The current sizes held unchanged through the window: V(t) = Σ qᵢ·Pᵢ(t).
 *
 * Equivalent to buying at the start-date weights qᵢ·Pᵢ(start)/V(start) and
 * never rebalancing. Contributions are in %p and add up to the period return.
 * A symbol without a price on a window date is a gap, not a zero return and not
 * a reason to reweight the rest.
 */
export function positionsPerformance(positions: Position[], history: PriceHistory, period: PortfolioPeriod, end: string) {
  const fail = (reason: PerformanceFailure, limiting: string[] = []) => ({ reason, limiting, points: [] as ModelPoint[], returnPercent: null as number | null, dailyPercent: null as number | null, contributions: [] as { symbol: string; contribution: number; endWeight: number }[], start: null as string | null });
  const active = positions.filter((p): p is Position & { quantity: number } => p.quantity !== null && p.quantity > 0);
  if (!active.length) return fail("no_position");
  const series = active.map(p => new Map((history[p.symbol] ?? []).filter(x => isDate(x.date) && finite(x.close) && x.close > 0).map(x => [x.date,x.close])));
  const unpriced = active.filter((_, i) => !series[i].has(end)).map(p => p.symbol);
  if (unpriced.length) return fail("missing_price", unpriced);
  const common = [...series[0].keys()].filter(d => series.every(s => s.has(d))).sort();
  const referenceDates = (history.SPY ?? []).filter(p => isDate(p.date) && finite(p.close) && p.close > 0).map(p => p.date);
  const calendar = referenceDates.includes(end) ? referenceDates : common;
  const start = periodStart(period === "ALL" ? common : calendar, period, end);
  const short = start ? active.filter((_, i) => !series[i].has(start)).map(p => p.symbol) : [];
  if (!start || short.length) return fail("insufficient_history", short);
  const union = new Set([...calendar,...series.flatMap(s => [...s.keys()])].filter(d => d >= start && d <= end));
  const gaps = active.filter((_, i) => [...union].some(d => !series[i].has(d))).map(p => p.symbol);
  if (gaps.length) return fail("history_gap", gaps);
  const dates = common.filter(d => d >= start && d <= end);
  const startValue = active.reduce((n, p, i) => n + p.quantity * series[i].get(start)!, 0);
  const valueAt = (date: string) => active.reduce((n, p, i) => n + p.quantity * series[i].get(date)!, 0) / startValue;
  const points = dates.map(date => ({ date, value: valueAt(date), returnPercent: (valueAt(date) - 1) * 100 }));
  const last = points.at(-1)!;
  const prior = points.at(-2);
  return { reason: null, limiting: [] as string[], points, start, returnPercent: last.returnPercent,
    dailyPercent: prior ? (last.value / prior.value - 1) * 100 : null,
    contributions: active.map((p, i) => {
      const startWeight = p.quantity * series[i].get(start)! / startValue * 100;
      const ratio = series[i].get(end)! / series[i].get(start)!;
      return { symbol: p.symbol, contribution: startWeight * (ratio - 1), endWeight: startWeight * ratio / last.value };
    }) };
}
