"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { watchlistRows } from "@/lib/watchlist-summary";
import { compareObservations, makeObservation, parseObservations, rememberObservation, type Observation, type WatchlistChange } from "@/lib/watchlist-observations";
import { formatSigma } from "@/lib/format";
import { productEvent } from "@/lib/product-events";
import type { MarketSnapshot, StockData } from "@/lib/types";
const KEY = "sigma-watchlist-observations:v1";
const COPY: Record<WatchlistChange, [string,string]> = {
  entered_upper_band: ["상단 경계 밖으로 이동", "Moved outside upper band"], entered_lower_band: ["하단 경계 밖으로 이동", "Moved outside lower band"], returned_inside: ["±1σ 범위 안으로 복귀", "Returned inside ±1σ"], approaching_upper_band: ["상단 경계 근접", "Approaching upper band"], approaching_lower_band: ["하단 경계 근접", "Approaching lower band"], largest_sigma_move: ["σ 위치 변화가 가장 큰 종목", "Largest sigma move"], new_band_window: ["새 주간 밴드가 적용되었습니다", "A new weekly band is in effect"], data_became_available: ["데이터 제공 시작", "Data now available"], data_became_unavailable: ["데이터 미제공", "Data unavailable"],
};
/** Mounted only after the browser watchlist is ready. Freeze the comparison for this visit. */
export function WatchlistChanges({ symbols, stocks, snapshot }: { symbols: string[]; stocks: StockData[]; snapshot: MarketSnapshot }) {
  const { pick } = useLocale();
  const current = makeObservation(watchlistRows(symbols, stocks, snapshot));
  const [baseline] = useState(() => {
    try { const raw = localStorage.getItem(KEY); return { history: raw ? parseObservations(raw) : [] as Observation[], raw, error: false }; }
    catch { return { history: [] as Observation[], raw: null, error: true }; }
  });
  const result = current ? compareObservations(baseline.history[0] ?? null, current) : null;
  const serialized = current ? JSON.stringify(current) : null;
  useEffect(() => {
    if (!serialized || baseline.error) return;
    try {
      const next = JSON.parse(serialized) as Observation;
      const raw = localStorage.getItem(KEY);
      const history = raw ? parseObservations(raw) : [];
      localStorage.setItem(KEY, JSON.stringify(rememberObservation(history, next)));
      productEvent("watchlist_change_view", "my_sigma");
    } catch { /* Existing corrupt observations are preserved. */ }
  }, [serialized, baseline.error]);
  if (!symbols.length) return null;
  const message = baseline.error ? pick("이전 관측을 읽을 수 없습니다. 기존 기록은 보존합니다.", "Previous observations could not be read; stored records are preserved.") : !result ? pick("비교 가능한 데이터 기준을 기다리고 있습니다.", "Waiting for a comparable data basis.") : result.state === "first" ? pick("첫 관측입니다. 다음 종가부터 변화를 비교합니다.", "First observation. Changes appear after the next close.") : result.state === "same" ? pick("아직 새로운 종가 데이터가 반영되지 않았습니다.", "No new closing snapshot yet.") : result.state === "correction" ? pick("같은 세션의 정정 데이터입니다. 새 경계 통과로 세지 않습니다.", "Corrected session data; not a new boundary event.") : result.state === "incompatible" ? pick("계산 기준이 달라 이전 관측과 비교할 수 없습니다.", "The observation basis changed.") : pick("마지막 확인 이후 새로운 경계 이탈은 없습니다.", "No new boundary crossings since your last visit.");
  return <section className="rounded-2xl border border-border p-4 sm:p-5"><h2 className="text-base font-semibold">{pick("마지막 확인 이후", "Since your last visit")}</h2>
    {result?.changes.length ? <ul className="mt-3 divide-y divide-border/50">{result.changes.slice(0, 5).map((change,i) => <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">{change.symbol && <Link href={`/symbol/${change.symbol}`} className="font-semibold underline-offset-4 hover:underline">{change.symbol}</Link>}<span>{pick(...COPY[change.type])}</span>{change.before != null && change.after != null && <span className="num text-muted-foreground">{formatSigma(change.before)} → {formatSigma(change.after)}</span>}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
  </section>;
}
