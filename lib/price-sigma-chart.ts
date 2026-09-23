import type { PriceSigmaPoint } from "./market-history";

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
