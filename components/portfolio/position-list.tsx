"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { GexContext } from "@/components/my-sigma/sigma-summary";
import { formatCurrency, formatPercent, formatSigma } from "@/lib/format";
import { parseAmount, quantityFromValue, type Position, type PositionRow } from "@/lib/portfolio";
import { isApproachingSigma, isOutsideSigma, STATUS_META } from "@/lib/sigma";
import { cn } from "@/lib/utils";

export type SizeUnit = "shares" | "value";

const sameAmount = (a: number | null, b: number | null) =>
  a === b || (a !== null && b !== null && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));
const formatAmount = (value: number | null, digits: number) => (value === null ? "" : String(Number(value.toFixed(digits))));

/**
 * A number box that commits every readable keystroke, so the weight and value
 * beside it move as you type and there is nothing left to save.
 */
function AmountField({
  label, name, value, digits, onCommit, placeholder, disabled, autoFocus, enterKeyHint,
}: {
  /** `label` is what is printed; `name` is what a screen reader hears, symbol included. */
  label: string; name: string; value: number | null; digits: number; onCommit: (value: number | null) => void;
  placeholder?: string; disabled?: boolean; autoFocus?: boolean; enterKeyHint?: "next" | "done";
}) {
  const [text, setText] = React.useState(() => formatAmount(value, digits));
  const [seen, setSeen] = React.useState(value);
  // Follow a value changed elsewhere (another tab, a pasted list) during render
  // rather than in an effect, and never rewrite "10." while it is being typed.
  if (!sameAmount(value, seen)) {
    setSeen(value);
    if (!sameAmount(parseAmount(text) ?? null, value)) setText(formatAmount(value, digits));
  }
  const invalid = parseAmount(text) === undefined;

  return (
    <label className="block min-w-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint={enterKeyHint}
        // Only a row added a moment ago asks for focus, so the next thing typed is its size.
        autoFocus={autoFocus}
        value={text}
        aria-label={name}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = parseAmount(event.target.value);
          if (parsed !== undefined) onCommit(parsed);
        }}
        onBlur={() => { if (invalid) setText(formatAmount(value, digits)); }}
        className="num mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-right text-base outline-offset-2 placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 aria-invalid:border-down"
      />
    </label>
  );
}

function PositionItem({
  row, unit, session, autoFocus, onChange, onRemove,
}: {
  row: PositionRow; unit: SizeUnit; session: string; autoFocus: boolean;
  onChange: (symbol: string, patch: Partial<Position>) => void; onRemove: (symbol: string) => void;
}) {
  const { pick } = useLocale();
  const stock = row.stock;
  const price = stock && Number.isFinite(stock.price) && stock.price > 0 ? stock.price : null;
  const z = stock?.zScore ?? NaN;
  const commitSize = (amount: number | null) => {
    if (unit === "shares" || amount === null) onChange(row.symbol, { quantity: amount });
    else if (price !== null) onChange(row.symbol, { quantity: quantityFromValue(amount, price) });
  };
  const place = !Number.isFinite(z) ? pick("σ 자료 없음", "No sigma")
    : isOutsideSigma(z) ? pick(z > 0 ? "상단 경계 밖" : "하단 경계 밖", z > 0 ? "Above band" : "Below band")
    : isApproachingSigma(z) ? pick("경계 근접", "Near band") : pick("범위 안", "Inside band");

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <Link prefetch={false} href={`/symbol/${row.symbol}`} className="text-sm font-semibold tracking-wide underline-offset-4 hover:underline">{row.symbol}</Link>
            <span className="truncate text-xs text-muted-foreground">{stock?.name ?? pick("현재 데이터 없음", "Unavailable")}</span>
          </div>
          {price !== null && (
            <p className="num mt-0.5 text-xs text-muted-foreground">
              {formatCurrency(price)}{" "}
              <span className={cn(stock!.changePercent > 0 ? "text-up" : stock!.changePercent < 0 ? "text-down" : "")}>{formatPercent(stock!.changePercent)}</span>
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="num text-base font-semibold" style={stock ? { color: `var(${STATUS_META[stock.status].colorVar})` } : undefined}>{formatSigma(z)}</span>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{place}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(row.symbol)}
          aria-label={pick(`${row.symbol} 포트폴리오에서 삭제`, `Remove ${row.symbol} from the portfolio`)}
          className="-mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="grid w-full grid-cols-2 gap-2 sm:w-72">
          <AmountField
            key={unit}
            label={unit === "shares" ? pick("보유 수량 (주)", "Shares") : pick("평가금액 ($)", "Value ($)")}
            name={unit === "shares" ? pick(`${row.symbol} 보유 수량 (주)`, `${row.symbol} shares`) : pick(`${row.symbol} 평가금액 (달러)`, `${row.symbol} value in dollars`)}
            value={unit === "shares" ? row.quantity : row.value}
            digits={unit === "shares" ? 6 : 2}
            onCommit={commitSize}
            placeholder={pick("입력", "Enter")}
            disabled={unit === "value" && price === null}
            autoFocus={autoFocus}
            enterKeyHint="next"
          />
          <AmountField
            label={pick("평단 ($) · 선택", "Avg cost ($) · optional")}
            name={pick(`${row.symbol} 평균 매입단가 (달러, 선택)`, `${row.symbol} average cost in dollars, optional`)}
            value={row.averageCost}
            digits={4}
            onCommit={(averageCost) => onChange(row.symbol, { averageCost })}
            placeholder="—"
            enterKeyHint="done"
          />
        </div>

        {row.value !== null ? (
          <div className="min-w-0 flex-1 basis-56">
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{pick("비중", "Weight")} <span className="num font-semibold text-foreground">{row.weight === null ? "—" : `${row.weight.toFixed(1)}%`}</span></span>
              <span className="num">
                {formatCurrency(row.value)}
                {row.profit !== null && (
                  <span className={cn("ml-2", row.profit > 0 ? "text-up" : row.profit < 0 ? "text-down" : "text-muted-foreground")}>
                    {row.profit >= 0 ? "+" : "−"}{formatCurrency(Math.abs(row.profit))} ({formatPercent(row.profitPercent ?? NaN, 1)})
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, row.weight ?? 0)}%` }} />
            </div>
          </div>
        ) : (
          <p className="min-w-0 flex-1 basis-56 pb-3 text-xs text-muted-foreground">
            {price === null
              ? pick("현재 가격이 없어 계산에서 제외됩니다.", "No current price; left out of the totals.")
              : unit === "shares"
                ? pick("수량을 입력하면 비중과 평가금액이 자동으로 계산됩니다.", "Enter a share count and the weight and value fill in.")
                : pick("금액을 입력하면 오늘 종가로 수량을 환산해 저장합니다.", "Enter a dollar value; it is stored as shares at today’s close.")}
          </p>
        )}
      </div>

      {stock && <div className="mt-2.5 flex flex-wrap gap-1.5"><GexContext stock={stock} session={session} /></div>}
    </li>
  );
}

export function PositionList({
  rows, unit, session, focusSymbol, onChange, onRemove,
}: {
  rows: PositionRow[]; unit: SizeUnit; session: string; focusSymbol: string | null;
  onChange: (symbol: string, patch: Partial<Position>) => void; onRemove: (symbol: string) => void;
}) {
  const { pick } = useLocale();
  return (
    <ul aria-label={pick("보유 종목", "Holdings")} className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
      {rows.map((row) => (
        <PositionItem key={row.symbol} row={row} unit={unit} session={session} autoFocus={row.symbol === focusSymbol} onChange={onChange} onRemove={onRemove} />
      ))}
    </ul>
  );
}
