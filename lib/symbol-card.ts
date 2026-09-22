import { isOutsideSigma } from "./sigma";
import { formatCurrency, formatPercent, formatSigma } from "./format";
import type { StockData, MarketSnapshot } from "./types";
export function symbolCardData(stock: StockData, snapshot: MarketSnapshot, locale: "ko"|"en") {
  const known = Number.isFinite(stock.zScore);
  const state = !known ? (locale==="ko"?"σ 미제공":"Sigma unavailable") : isOutsideSigma(stock.zScore) ? (locale==="ko" ? (stock.zScore>0?"상단 경계 밖":"하단 경계 밖") : (stock.zScore>0?"At / above +1σ":"At / below −1σ")) : (locale==="ko"?"이번 주 범위 안":"Inside this week’s range");
  return { symbol:stock.symbol,name:stock.name,price:formatCurrency(stock.price),change:formatPercent(stock.changePercent),sigma:formatSigma(stock.zScore),state,
    lower:formatCurrency(stock.sigma1Lower),upper:formatCurrency(stock.sigma1Upper),anchor:formatCurrency(stock.anchor),
    support:stock.gex?.support[0]?formatCurrency(stock.gex.support[0].strike):null,
    resistance:stock.gex?.resistance[0]?formatCurrency(stock.gex.resistance[0].strike):null,
    session:snapshot.sessionDate,window:`${snapshot.bandAnchorDate} – ${snapshot.bandEndDate ?? "—"}` };
}
export function symbolImageUrl(symbol: string, snapshotId: string, locale: "ko"|"en", layout: "feed"|"og") {
  return `/api/symbol-image/${encodeURIComponent(symbol)}?snapshot=${encodeURIComponent(snapshotId)}&locale=${locale}&layout=${layout}`;
}
