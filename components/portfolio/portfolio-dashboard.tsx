"use client";

import * as React from "react";

import { useLocale } from "@/components/locale-provider";
import { replacePortfolio, updatePortfolio, usePortfolio, type PortfolioSaveResult } from "@/hooks/use-portfolio";
import { saveWatchlist, useWatchlist } from "@/hooks/use-watchlist";
import { formatCurrency, formatPercent, formatSigma } from "@/lib/format";
import { mergePositions, parsePortfolio, POSITION_LIMIT, valuePositions, type PortfolioDocument, type Position } from "@/lib/portfolio";
import { resolveStatus, STATUS_META } from "@/lib/sigma";
import type { MarketSnapshot, StockData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { normalizeSymbols } from "@/lib/watchlist";

import { AddPositions, type AddSource } from "./add-positions";
import { PortfolioPerformance } from "./portfolio-performance";
import { PositionList, type SizeUnit } from "./position-list";

const button = "inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 text-sm hover:bg-muted/30 disabled:opacity-40";
/** Long enough to reach "undo" after noticing the row is gone. */
const TOAST_MS = { plain: 5000, undo: 9000 };

function download(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Toast = { id: number; text: string; undo?: { position: Position; index: number } };

export function PortfolioDashboard({ stocks, snapshot }: { stocks: StockData[]; snapshot: MarketSnapshot }) {
  const { pick } = useLocale();
  const store = usePortfolio();
  const watchlist = useWatchlist();
  const [unit, setUnit] = React.useState<SizeUnit>("shares");
  const [focusSymbol, setFocusSymbol] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<Toast | null>(null);
  const [imported, setImported] = React.useState<PortfolioDocument | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.undo ? TOAST_MS.undo : TOAST_MS.plain);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const say = (text: string, undo?: Toast["undo"]) => setToast({ id: Date.now(), text, undo });
  const report = (result: PortfolioSaveResult) => {
    if (result === "conflict") say(pick("다른 탭에서 바뀐 내용을 불러왔습니다. 방금 입력은 다시 해 주세요.", "Loaded changes from another tab. Please redo the last edit."));
    else if (result === "invalid" || result === "unavailable") say(pick("저장하지 못했습니다.", "Could not save."));
    return result === "saved" || result === "memory";
  };

  if (!store.ready || !watchlist.ready) return <p className="py-12 text-sm text-muted-foreground">{pick("포트폴리오를 불러오는 중…", "Loading your portfolio…")}</p>;

  if (store.error === "corrupt") {
    return (
      <div className="space-y-4">
        <div role="alert" className="rounded-xl border border-border p-5 text-sm">
          <p>{pick("저장된 포트폴리오를 읽을 수 없습니다. 원본을 내려받아 두거나 정상 백업을 가져오세요. 기존 자료는 자동으로 지우지 않습니다.", "The stored portfolio could not be read. Download the original or import a valid backup; nothing is deleted automatically.")}</p>
          <button className={`${button} mt-3`} onClick={() => download(store.raw ?? "", "my-sigma-portfolio-original.json")}>{pick("원본 내려받기", "Download original")}</button>
        </div>
        <BackupTools raw={store.raw} imported={imported} onImported={setImported} onApply={(doc) => { if (report(replacePortfolio(doc))) { setImported(null); say(pick("백업을 적용했습니다.", "Backup applied.")); } }} />
      </div>
    );
  }

  const positions = store.value.positions;
  const valuation = valuePositions(positions, stocks);
  const held = new Set(positions.map((p) => p.symbol));

  const change = (symbol: string, patch: Partial<Position>) => {
    report(updatePortfolio((doc) => ({ ...doc, positions: doc.positions.map((p) => (p.symbol === symbol ? { ...p, ...patch } : p)) })));
  };

  const remove = (symbol: string) => {
    const index = positions.findIndex((p) => p.symbol === symbol);
    if (index < 0) return;
    const position = positions[index];
    if (report(updatePortfolio((doc) => ({ ...doc, positions: doc.positions.filter((p) => p.symbol !== symbol) })))) {
      say(pick(`${symbol} 삭제됨`, `Removed ${symbol}`), { position, index });
    }
  };

  const undo = (item: NonNullable<Toast["undo"]>) => {
    report(updatePortfolio((doc) => {
      if (doc.positions.some((p) => p.symbol === item.position.symbol) || doc.positions.length >= POSITION_LIMIT) return doc;
      const next = [...doc.positions];
      next.splice(Math.min(item.index, next.length), 0, item.position);
      return { ...doc, positions: next };
    }));
    setToast(null);
  };

  /**
   * A held symbol is one you watch. Adding it here also stars it, so it shows up
   * in My Sigma and on the home summary without a second trip.
   */
  const add = (incoming: Position[], source: AddSource) => {
    const merged: { result?: ReturnType<typeof mergePositions> } = {};
    const saved = report(updatePortfolio((doc) => {
      merged.result = mergePositions(doc.positions, incoming);
      return { ...doc, positions: merged.result.positions };
    }));
    const result = merged.result;
    if (!saved || !result) return;
    const starred = normalizeSymbols([...watchlist.symbols, ...result.added]);
    const newlyStarred = result.added.filter((s) => starred.includes(s) && !watchlist.symbols.includes(s));
    const unstarred = result.added.filter((s) => !starred.includes(s));
    if (newlyStarred.length) saveWatchlist(starred);
    // One new row means the next thing to type is its size.
    if (source !== "paste" && result.added.length === 1) setFocusSymbol(result.added[0]);

    const updated = incoming.length - result.added.length - result.skipped.length;
    const parts = [
      result.added.length === 1 && source !== "paste" ? pick(`${result.added[0]} 추가`, `Added ${result.added[0]}`) : result.added.length ? pick(`${result.added.length}개 추가`, `${result.added.length} added`) : null,
      updated > 0 ? pick(`${updated}개 수량 갱신`, `${updated} updated`) : null,
      newlyStarred.length ? pick("관심종목에도 넣었습니다", "also starred in your watchlist") : null,
      unstarred.length ? pick("관심종목이 가득 차 별표는 생략했습니다", "watchlist full, so not starred") : null,
      result.skipped.length ? pick(`한도(${POSITION_LIMIT}개)로 ${result.skipped.length}개 제외`, `${result.skipped.length} over the ${POSITION_LIMIT} limit`) : null,
    ].filter(Boolean);
    if (parts.length) say(parts.join(" · "));
  };

  const empty = positions.length === 0;
  const tone = (value: number | null) => (value === null ? "" : value > 0 ? "text-up" : value < 0 ? "text-down" : "");
  const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`;

  return (
    <div className="space-y-6">
      {!store.persistent && <p role="status" className="text-sm text-muted-foreground">{pick("브라우저 저장을 사용할 수 없어 이번 방문에만 유지됩니다.", "Storage unavailable; kept for this visit only.")}</p>}

      {valuation.value !== null ? (
        <section aria-label={pick("포트폴리오 요약", "Portfolio summary")} className="glass overflow-hidden rounded-2xl">
          <div className="px-5 py-5 sm:px-6">
            <p className="text-xs text-muted-foreground">{pick("평가금액", "Market value")} · {snapshot.sessionDate} {pick("종가", "close")}</p>
            <p className="num mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{formatCurrency(valuation.value)}</p>
            <p className={cn("num mt-1.5 text-sm", tone(valuation.daily))}>
              {valuation.daily === null ? "—" : `${signedMoney(valuation.daily)} (${formatPercent(valuation.dailyPercent ?? NaN)})`}
              <span className="ml-1.5 text-xs text-muted-foreground">{pick("전일 대비", "vs prior close")}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border/50 border-t border-border/50">
            <div className="px-5 py-4 sm:px-6">
              <p className="text-xs text-muted-foreground">{pick("평가손익", "Unrealized gain")}</p>
              <p className={cn("num mt-1.5 text-lg font-semibold", tone(valuation.profit))}>{valuation.profit === null ? "—" : signedMoney(valuation.profit)}</p>
              <p className="num text-xs text-muted-foreground">
                {valuation.profit === null ? pick("평단을 입력하면 계산됩니다", "Add average costs to see it")
                  : `${formatPercent(valuation.profitPercent ?? NaN)}${valuation.costCount < valuation.pricedCount ? pick(` · 평단 입력 ${valuation.costCount}/${valuation.pricedCount}종목`, ` · ${valuation.costCount}/${valuation.pricedCount} with cost`) : ""}`}
              </p>
            </div>
            <div className="px-5 py-4 sm:px-6">
              <p className="text-xs text-muted-foreground">{pick("비중 가중 σ 위치", "Weighted σ position")}</p>
              <p className="num mt-1.5 text-lg font-semibold" style={valuation.weightedSigma === null ? undefined : { color: `var(${STATUS_META[resolveStatus(valuation.weightedSigma)].colorVar})` }}>{formatSigma(valuation.weightedSigma ?? NaN)}</p>
              <p className="text-xs text-muted-foreground">{pick("이번 주 밴드 기준", "This week’s bands")}</p>
            </div>
          </div>
          {valuation.pricedCount < valuation.sizedCount && (
            <p className="border-t border-border/50 px-5 py-3 text-xs text-muted-foreground sm:px-6">{pick(`현재 가격이 없는 ${valuation.sizedCount - valuation.pricedCount}개 종목은 합계에서 제외했습니다.`, `${valuation.sizedCount - valuation.pricedCount} holding(s) without a current price are left out of the totals.`)}</p>
          )}
        </section>
      ) : !empty ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{pick("각 종목에 보유 수량(또는 금액)만 넣으면 평가금액·비중·손익이 자동으로 계산됩니다.", "Enter a share count (or a dollar value) for each holding and value, weight and gain fill in by themselves.")}</p>
      ) : null}

      <section aria-labelledby="portfolio-holdings" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="portfolio-holdings" className="text-lg font-semibold">{pick("보유 종목", "Holdings")} <span className="num text-sm font-normal text-muted-foreground">{positions.length}/{POSITION_LIMIT}</span></h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{pick("입력하는 즉시 이 브라우저에 자동 저장됩니다.", "Saved to this browser as you type.")}</p>
          </div>
          {!empty && (
            <div role="group" aria-label={pick("입력 단위", "Entry unit")} className="inline-flex rounded-lg border border-border p-0.5 text-xs">
              {(["shares", "value"] as const).map((key) => (
                <button key={key} type="button" aria-pressed={unit === key} onClick={() => setUnit(key)} className={cn("min-h-10 rounded-md px-3", unit === key ? "bg-foreground text-background" : "text-muted-foreground")}>
                  {key === "shares" ? pick("수량으로 입력", "By shares") : pick("금액($)으로 입력", "By value ($)")}
                </button>
              ))}
            </div>
          )}
        </div>

        {empty ? (
          <div className="rounded-2xl border border-dashed border-border p-5">
            <p className="font-medium">{pick("보유 종목을 담아 보세요", "Start with what you hold")}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{pick("종목을 고르고 수량만 입력하면 비중·평가금액·손익이 자동 계산되고, 각 종목의 σ 위치와 GEX 지지·저항도 함께 보입니다. 평단은 선택입니다.", "Pick symbols and enter share counts; weights, value and gain are computed for you, next to each name’s σ position and GEX levels. Average cost is optional.")}</p>
          </div>
        ) : (
          <PositionList rows={valuation.rows} unit={unit} session={snapshot.sessionDate} focusSymbol={focusSymbol} onChange={change} onRemove={remove} />
        )}

        <AddPositions stocks={stocks} held={held} watchlist={watchlist.symbols} onAdd={add} />
      </section>

      {!empty && <PortfolioPerformance positions={positions} stocks={stocks} snapshot={snapshot} />}

      <details className="rounded-2xl border border-border/60 px-5 py-1 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground">{pick("백업 · 다른 기기로 옮기기", "Backup · move to another device")}</summary>
        <div className="pb-4">
          <p className="text-xs leading-relaxed text-muted-foreground">{pick("포트폴리오는 서버에 보내지 않고 이 브라우저에만 저장합니다. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 파일로 내려받아 두세요.", "The portfolio never leaves this browser. Download a file before switching devices or clearing browser data.")}</p>
          <div className="mt-3"><BackupTools raw={store.raw ?? JSON.stringify(store.value, null, 2)} imported={imported} onImported={setImported} onApply={(doc) => { if (report(replacePortfolio(doc))) { setImported(null); say(pick("백업을 적용했습니다.", "Backup applied.")); } }} /></div>
        </div>
      </details>

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 text-sm shadow-lg backdrop-blur md:bottom-6">
          <p className="min-w-0 flex-1">{toast.text}</p>
          {toast.undo && <button type="button" onClick={() => undo(toast.undo!)} className="min-h-11 shrink-0 rounded-lg px-3 font-medium text-primary">{pick("되돌리기", "Undo")}</button>}
        </div>
      )}
    </div>
  );
}

function BackupTools({ raw, imported, onImported, onApply }: {
  raw: string | null; imported: PortfolioDocument | null;
  onImported: (doc: PortfolioDocument | null) => void; onApply: (doc: PortfolioDocument) => void;
}) {
  const { pick } = useLocale();
  const [error, setError] = React.useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {raw && <button type="button" className={button} onClick={() => download(raw, "my-sigma-portfolio.json")}>{pick("백업 내려받기", "Download backup")}</button>}
        <label className={`${button} cursor-pointer`}>
          {pick("백업 가져오기", "Import backup")}
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              try {
                if (file.size > 1_000_000) throw new Error("too large");
                onImported(parsePortfolio(await file.text()));
                setError("");
              } catch {
                setError(pick("지원하지 않거나 손상된 백업입니다. 기존 자료는 그대로입니다.", "Invalid backup; existing records are unchanged."));
              }
            }}
          />
        </label>
      </div>
      {error && <p role="alert" className="text-xs text-down">{error}</p>}
      {imported && (
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm">{pick(`${imported.positions.length}개 종목으로 교체합니다. 지금 자료는 직전 백업으로 남습니다.`, `Replace with ${imported.positions.length} holdings. The current records are kept as the previous backup.`)}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={button} onClick={() => onApply(imported)}>{pick("적용", "Apply")}</button>
            <button type="button" className={button} onClick={() => onImported(null)}>{pick("취소", "Cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
