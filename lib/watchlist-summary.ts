import { isOutsideSigma, isApproachingSigma } from "./sigma";
import type { MarketSnapshot, StockData } from "./types";

export interface WatchlistSigmaRow {
  symbol: string; zScore: number | null; snapshotId: string | null;
  bandStart: string | null; bandEnd: string | null; observedAt: string | null;
  methodVersion: string | null; priceBasis: string | null;
}
export function watchlistRows(symbols: string[], stocks: StockData[], snapshot: MarketSnapshot): WatchlistSigmaRow[] {
  const bySymbol = new Map(stocks.map(stock => [stock.symbol, stock]));
  return symbols.map(symbol => {
    const s = bySymbol.get(symbol);
    const z = s?.zScore ?? NaN;
    return { symbol, zScore: Number.isFinite(z) ? z : null, snapshotId: snapshot.snapshotId ?? null,
      bandStart: snapshot.bandAnchorDate, bandEnd: snapshot.bandEndDate ?? null, observedAt: snapshot.sessionDate,
      methodVersion: snapshot.methodVersion && (!Number.isFinite(z) || s?.sigmaBasis?.fromAnchor === true) ? `${snapshot.methodVersion}:anchor` : null, priceBasis: snapshot.priceBasis ?? null };
  });
}
export function summarizeWatchlistSigma(rows: WatchlistSigmaRow[]) {
  const valid = rows.filter((r): r is WatchlistSigmaRow & { zScore: number } => typeof r.zScore === "number" && Number.isFinite(r.zScore));
  const first = valid[0];
  const keys = ["snapshotId", "bandStart", "bandEnd", "observedAt", "methodVersion", "priceBasis"] as const;
  const complete = first && keys.every(key => !!first[key]);
  const comparable = !!complete && valid.every(row => keys.every(key => row[key] === first[key]));
  return { totalCount: rows.length, validCount: valid.length, comparable,
    meanSigma: comparable ? valid.reduce((n, r) => n + r.zScore, 0) / valid.length : null,
    meanAbsoluteSigma: comparable ? valid.reduce((n, r) => n + Math.abs(r.zScore), 0) / valid.length : null,
    outsideCount: comparable ? valid.filter(r => isOutsideSigma(r.zScore)).length : null,
    bandStart: comparable ? first.bandStart : null, bandEnd: comparable ? first.bandEnd : null,
    unavailableReason: !valid.length ? "no_data" : !complete ? "missing_basis" : !comparable ? "mixed_basis" : null };
}
export function attentionStocks(stocks: StockData[], limit = 3): StockData[] {
  return stocks.filter(s => Number.isFinite(s.zScore)).sort((a, b) =>
    Number(isOutsideSigma(b.zScore)) - Number(isOutsideSigma(a.zScore)) ||
    Number(isApproachingSigma(b.zScore)) - Number(isApproachingSigma(a.zScore)) ||
    Math.abs(b.zScore) - Math.abs(a.zScore) || a.symbol.localeCompare(b.symbol)).slice(0, limit);
}
