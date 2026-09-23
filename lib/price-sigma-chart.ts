import type { PriceSigmaPoint } from "./market-history";

export const PRICE_SIGMA_PERIODS = ["1M", "3M", "1Y", "ALL"] as const;
export type PriceSigmaPeriod = typeof PRICE_SIGMA_PERIODS[number];
export const DEFAULT_PRICE_SIGMA_PERIOD: PriceSigmaPeriod = "1Y";

/** Calendar periods include the same date last year (52 weeks can drop a session). */
export function priceSigmaPeriodStart(session: string, period: PriceSigmaPeriod) {
  if (period === "ALL") return "";
  const date = new Date(`${session}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - (period === "1M" ? 1 : period === "3M" ? 3 : 12));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

/** Domains use only the selected dates; missing sigma never becomes zero. */
export function priceSigmaDomains(rows: PriceSigmaPoint[]) {
  const prices = rows.flatMap(row => [row.close, row.lower1Sigma, row.upper1Sigma])
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const positions = rows.map(row => row.sigmaPosition)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const low = prices.length ? Math.min(...prices) : 0;
  const high = prices.length ? Math.max(...prices) : 1;
  const padding = Math.max(high - low, Math.abs(high) * 0.02, 0.01) * 0.08;
  const sigmaLow = Math.min(-1, ...positions);
  const sigmaHigh = Math.max(1, ...positions);
  const sigmaPadding = (sigmaHigh - sigmaLow) * 0.1;
  return {
    price: [Math.max(0, low - padding), high + padding] as [number, number],
    sigma: [sigmaLow - sigmaPadding, sigmaHigh + sigmaPadding] as [number, number],
  };
}
