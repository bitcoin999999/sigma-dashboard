"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { formatCurrency, formatPercent } from "@/lib/format";
import { BARS_PER_SESSION, WEEK_SLOTS, candleDomain, chartScaleMode, chartWeek, chartTimeLabel, priceTicks, type AxisFit, type WeeklyChartBand, type WeeklyChartData } from "@/lib/weekly-chart";
import { chartCacheWindow, shouldRefreshChart } from "@/lib/weekly-chart-refresh";
import { separatePriceLabels, type GexChartSnapshot } from "@/lib/gex-chart-levels";

/** Mounted only on /symbol/[symbol]; the board and its detail sheet stay daily. */
export function WeeklyPriceChart({ symbol, bands, gex }: { symbol: string; bands: WeeklyChartBand[]; gex?: GexChartSnapshot | null }) {
  const { pick, locale } = useLocale();
  const [data, setData] = useState<WeeklyChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<string | null>(null);
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    let lastAttempt: number | null = null;
    let timer: number;
    async function load(manual = false) {
      if (controller || document.hidden) return;
      const now = new Date();
      const week = chartWeek(now).weekStart;
      setCurrentWeek(week);
      if (!manual && !shouldRefreshChart(now, lastAttempt)) return;
      lastAttempt = now.getTime();
      controller = new AbortController();
      setLoading(true);
      try {
        const response = await fetch(`/api/weekly-chart/${encodeURIComponent(symbol)}?week=${week}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Chart unavailable");
        const next: WeeklyChartData = await response.json();
        if (next.symbol !== symbol || next.weekStart !== chartWeek().weekStart) throw new Error("Chart week changed");
        if (!disposed) { setData(next); setFailed(false); }
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        controller = null;
        if (!disposed) setLoading(false);
      }
    }
    // Manual checks also respect the browser/CDN cache; no cache-busting URL.
    refresh.current = () => { void load(true); };
    function tick() {
      void load();
      timer = window.setTimeout(tick, chartCacheWindow().end - Date.now() + 250);
    }
    tick();
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [symbol]);

  // Never leave last week's successful chart under a new week's heading.
  const chart = data?.symbol === symbol && data.weekStart === currentWeek ? data : null;
  const band = bands.find((entry) => entry.weekStart === chart?.weekStart);
  const days = chart?.dates ?? (currentWeek ? chartWeek(new Date(`${currentWeek}T16:00:00Z`)).dates : []);
  const dateLabel = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

  return (
    <section aria-label={pick(`${symbol} 이번 주 30분봉 차트`, `${symbol} weekly 30-minute chart`)} className="glass min-w-0 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold"><span className="num">{symbol}</span> {pick("이번 주 가격", "price this week")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {days.length > 0 && `${dateLabel(days[0])}–${dateLabel(days[4])} · `}
            {pick("30분봉 · 미국 정규장 · 시간 KST", "30-minute candles · US regular session (ET)")}
          </p>
        </div>
        <button type="button" disabled={loading} onClick={() => refresh.current()}
          aria-label={pick("주간 차트 새로고침", "Refresh weekly chart")}
          className="shrink-0 rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40">
          <RefreshCw aria-hidden className={`size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />
        </button>
      </div>

      {chart ? <WeeklyCandlePlot key={`${chart.symbol}:${chart.weekStart}`} data={chart} band={band} gex={gex} /> : (
        <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground" role="status">
          {loading ? pick("30분봉을 불러오는 중…", "Loading 30-minute candles…") : failed ? pick("주간 차트를 불러오지 못했습니다.", "Weekly chart is unavailable.") : pick("다음 정규장에 주간 차트를 갱신합니다.", "The weekly chart will refresh at the next regular session.")}
        </div>
      )}

      {failed && chart && <p role="status" className="mt-3 text-xs text-down">
        {pick("갱신 실패 · 마지막으로 받은 데이터를 표시합니다.", "Refresh failed · showing the last received data.")}
      </p>}
      <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
        <span>{pick("Yahoo Finance · 지연 가능 · 장중 30분 간격", "Yahoo Finance · may be delayed · every 30 minutes during market hours")}</span>
        {chart && <span className="num">{pick("확인", "Checked")} {chartTimeLabel(new Date(chart.fetchedAt), locale)}</span>}
      </div>
    </section>
  );
}

const TOGGLE_ON = "border-transparent bg-[color-mix(in_oklch,var(--primary)_22%,transparent)] text-foreground";
const TOGGLE_OFF = "border-border/70 text-muted-foreground hover:text-foreground";

/**
 * Half the height of a level tag in the price gutter.
 *
 * The tag used to be one line of price with the level's name printed inside the
 * plot, pinned to the right edge. That edge is empty on Monday and full of
 * Friday's candles by the end of the week, so on Friday the names sat on top of
 * the newest bars — the ones you are actually looking at. The name moved into
 * the tag, above its price, which puts every piece of level text outside the
 * candle area for good.
 */
const TAG_HALF = 13;

export function WeeklyCandlePlot({ data, band: suppliedBand, gex: suppliedGex }: { data: WeeklyChartData; band?: WeeklyChartBand; gex?: GexChartSnapshot | null }) {
  const { pick, locale } = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  const [selected, setSelected] = useState<number | null>(null);
  const [pointerPrice, setPointerPrice] = useState<number | null>(null);
  const [showGex, setShowGex] = useState(true);
  const [secondary, setSecondary] = useState(false);
  const [fit, setFit] = useState<AxisFit>("candles");
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Friday's new band belongs to NEXT week; never overlay it on this week.
  const band = suppliedBand?.weekStart === data.weekStart ? suppliedBand : undefined;
  const gex = suppliedGex?.weekStart === data.weekStart ? suppliedGex : null;
  const gexLines = showGex && gex ? gex.levels.filter((level) => secondary || level.rank === 1) : [];
  const confluence = (price: number, role: string) => Boolean(band && gex && role === "support" &&
    gex.floorWeekStart === data.weekStart && gex.floorStrike === price);
  const last = data.candles.at(-1);
  const scaleMode = chartScaleMode(last?.close, band);
  const [floor, ceiling] = candleDomain(data.candles, band, gexLines.map((level) => level.price), fit);

  const compact = width < 560;
  const height = compact ? 320 : width < 760 ? 400 : 452;
  const left = 6, top = 12, bottom = 46;
  const right = Math.max(56, formatCurrency(ceiling).length * 7 + 18);
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const slotWidth = plotWidth / WEEK_SLOTS;
  const x = (slot: number) => left + (slot + 0.5) * slotWidth;
  const y = (price: number) => top + (ceiling - price) / (ceiling - floor) * plotHeight;
  const hovered = data.candles.find((bar) => bar.slot === selected);
  const active = hovered ?? last;
  const previous = active ? data.candles[data.candles.indexOf(active) - 1] : undefined;
  const reference = previous?.close ?? active?.open;
  const activeChange = active && reference ? (active.close - reference) / reference * 100 : null;
  const hoveredDay = hovered ? data.dates.indexOf(hovered.date) : -1;
  const pointerY = pointerPrice === null ? null : y(pointerPrice);
  const ticks = priceTicks(floor, ceiling, compact ? 4 : 6);

  const inView = (price: number) => price >= floor && price <= ceiling;
  const candidates = [
    ...(scaleMode === "upper-breakout" && band ? [
      { label: pick("앵커", "Anchor"), value: band.anchor, color: "var(--muted-foreground)", dash: "3 3", weight: 1, kind: "sigma" as const, note: "" },
    ] : []),
    ...(band ? [
      { label: "+1σ", value: band.upper, color: "var(--sigma-upper)", dash: "6 4", weight: 1.4, kind: "sigma" as const, note: "" },
      { label: "−1σ", value: band.lower, color: "var(--sigma-lower)", dash: "6 4", weight: 1.4, kind: "sigma" as const, note: "" },
    ] : []),
    ...(band?.upper2 !== undefined && band?.lower2 !== undefined ? [
      { label: "+2σ", value: band.upper2, color: "var(--sigma-upper)", dash: "1 5", weight: 1, kind: "sigma" as const, note: "" },
      { label: "−2σ", value: band.lower2, color: "var(--sigma-lower)", dash: "1 5", weight: 1, kind: "sigma" as const, note: "" },
    ] : []),
    ...gexLines.map((level) => ({
      label: `GEX ${level.role === "support" ? "S" : "R"}${level.rank}`, value: level.price,
      color: level.role === "support" ? "var(--gex-support)" : "var(--gex-resistance)",
      dash: "9 5", weight: level.strong ? 2.25 : 1.25, kind: "gex" as const,
      note: [level.strong ? pick("강한 후보", "Strong candidate") : "",
        confluence(level.price, level.role) ? pick("−1σ 합치", "−1σ confluence") : ""].filter(Boolean).join(" · "),
    })),
  ];
  // The last-price tag shares the gutter with the level tags, so it has to be
  // part of the same separation pass or it lands on top of a σ/GEX price.
  const placed = separatePriceLabels([
    ...candidates.filter((level) => inView(level.value)),
    ...(last ? [{ label: "", value: last.close, color: "", dash: "", weight: 0, kind: "last" as const, note: "" }] : []),
  ], y, top + TAG_HALF, height - bottom - TAG_HALF);
  const levels = placed.filter((level) => level.kind !== "last");
  const lastTagY = placed.find((level) => level.kind === "last")?.labelY;
  // ±2σ off screen is the normal case and says nothing; ±1σ or a GEX strike
  // leaving the frame is the thing worth a marker.
  const offScale = candidates.filter((level) => !inView(level.value) &&
    (level.kind === "gex" || level.label === "+1σ" || level.label === "−1σ"));
  const above = offScale.filter((level) => level.value > ceiling).sort((a, b) => a.value - b.value);
  const below = offScale.filter((level) => level.value < floor).sort((a, b) => b.value - a.value);
  const expandTo = (group: typeof candidates): AxisFit => group.some((level) => level.kind === "gex") ? "all" : "sigma";

  const weekdays = locale === "ko" ? ["월", "화", "수", "목", "금"] : ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const dateLabel = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
  // Year is already in the heading; the axis only needs the day and the clock.
  const stampLabel = (at: Date) => chartTimeLabel(at, locale).slice(5);
  const fits: { id: AxisFit; text: string; hint: string }[] = [
    { id: "candles", text: pick("캔들", "Candles"), hint: pick("이번 주 봉의 고가/저가에 맞춥니다.", "Fit this week's candle high/low.") },
    { id: "sigma", text: "±1σ", hint: pick("±1σ 밴드까지 넓힙니다.", "Widen to the ±1σ band.") },
    ...(gexLines.length ? [{ id: "all" as AxisFit, text: pick("전체", "Full"),
      hint: pick("±1σ와 GEX 행사가까지 모두 넣습니다.", "Include the ±1σ band and the GEX strikes.") }] : []),
  ];

  return (
    <div ref={container} className="mt-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/60 pt-2.5 text-[11px]">
        <p className="text-muted-foreground">
          {gex ? `${pick("GEX 참고선", "GEX levels")} · OI ${gex.oiAsOf || pick("기준일 미제공", "date unavailable")}` :
            pick("GEX 참고선 없음", "No GEX levels")}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {gex && <>
            <button type="button" aria-pressed={showGex} onClick={() => setShowGex(!showGex)}
              className={`rounded-full border px-2.5 py-1 font-medium transition-colors ${showGex ? TOGGLE_ON : TOGGLE_OFF}`}>GEX</button>
            <button type="button" aria-pressed={secondary} disabled={!showGex} onClick={() => setSecondary(!secondary)}
              title={pick("GEX 규모 기준 두 번째 지지(S2)·저항(R2) 후보입니다.", "Second-ranked support (S2) and resistance (R2) candidates by GEX size.")}
              className={`rounded-full border px-2.5 py-1 font-medium transition-colors disabled:opacity-40 ${secondary && showGex ? TOGGLE_ON : TOGGLE_OFF}`}>S2·R2</button>
          </>}
          <div role="group" aria-label={pick("가격 축 범위", "Price axis range")} className="ml-1 inline-flex rounded-full border border-border/70 p-0.5">
            {fits.map((option) => <button key={option.id} type="button" aria-pressed={fit === option.id}
              onClick={() => setFit(option.id)} title={option.hint}
              className={`num rounded-full px-2.5 py-0.5 font-medium transition-colors ${fit === option.id ? "bg-[color-mix(in_oklch,var(--primary)_26%,transparent)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {option.text}
            </button>)}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {active ? `${chartTimeLabel(new Date(active.timestamp * 1000), locale)} · ${active.complete ? pick("완성 봉", "Closed candle") : pick("진행 중", "In progress")}` : pick("이번 주 수신된 정규장 봉이 없습니다.", "No regular-session candles received this week.")}
      </p>

      <div className="relative mt-1">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" tabIndex={0}
        aria-label={pick(`${data.symbol}, ${data.weekStart}~${data.weekEnd}, 30분봉 ${data.candles.length}개. 좌우 방향키로 봉을 확인합니다.`, `${data.symbol}, ${data.weekStart} to ${data.weekEnd}, ${data.candles.length} 30-minute candles. Use arrow keys to inspect candles.`)}
        className="block cursor-crosshair rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const px = (event.clientX - bounds.left) / bounds.width * width;
          const py = (event.clientY - bounds.top) / bounds.height * height;
          const inside = px >= left && px < left + plotWidth && py >= top && py <= height - bottom;
          setSelected(inside ? Math.floor((px - left) / slotWidth) : null);
          setPointerPrice(inside ? ceiling - ((py - top) / plotHeight) * (ceiling - floor) : null);
        }}
        onPointerLeave={() => { setSelected(null); setPointerPrice(null); }}
        onFocus={() => { setSelected(last?.slot ?? null); setPointerPrice(null); }}
        onBlur={() => { setSelected(null); setPointerPrice(null); }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !last) return;
          event.preventDefault();
          setPointerPrice(null);
          const index = data.candles.findIndex((bar) => bar.slot === (selected ?? last.slot));
          const next = event.key === "Home" ? 0 : event.key === "End" ? data.candles.length - 1 :
            Math.max(0, Math.min(data.candles.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)));
          setSelected(data.candles[next].slot);
        }}>
        <title>{pick("이번 주 30분봉 · 월요일부터 금요일까지", "This week's 30-minute candles · Monday through Friday")}</title>
        {data.dates.map((date, day) => <g key={date}>
          <rect x={left + day * BARS_PER_SESSION * slotWidth} y={top}
            width={BARS_PER_SESSION * slotWidth} height={plotHeight} fill="var(--foreground)" opacity={day % 2 === 0 ? 0.03 : 0} />
          {day > 0 && <line x1={left + day * BARS_PER_SESSION * slotWidth} x2={left + day * BARS_PER_SESSION * slotWidth}
            y1={top} y2={height - bottom} stroke="var(--border)" />}
          {hoveredDay !== day && <text x={left + (day + 0.5) * BARS_PER_SESSION * slotWidth} y={height - 26} textAnchor="middle" fill="var(--muted-foreground)" fontSize={12}>
            {weekdays[day]}
            <tspan x={left + (day + 0.5) * BARS_PER_SESSION * slotWidth} dy={15} className="num">{dateLabel(date)}</tspan>
          </text>}
        </g>)}
        {last && last.slot < WEEK_SLOTS - 1 && <rect x={x(last.slot) + slotWidth / 2} y={top}
          width={(WEEK_SLOTS - last.slot - 1) * slotWidth} height={plotHeight} fill="var(--foreground)" opacity={0.03} />}
        {band && band.upper > floor && band.lower < ceiling && <rect x={left} y={y(Math.min(band.upper, ceiling))} width={plotWidth}
          height={y(Math.max(band.lower, floor)) - y(Math.min(band.upper, ceiling))} fill="var(--sigma-normal)" opacity={0.06} />}
        {ticks.map((price) => <g key={price}>
          <line x1={left} x2={width - right} y1={y(price)} y2={y(price)} stroke="var(--border)" strokeOpacity={0.55} />
          {!placed.some((level) => Math.abs(level.labelY - y(price)) < TAG_HALF + 7) && <text x={width - right + 8} y={y(price)} dominantBaseline="middle" fill="var(--muted-foreground)" fontSize={11} className="num">{formatCurrency(price)}</text>}
        </g>)}
        <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="var(--border)" />
        <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="var(--border)" />
        {last && <line x1={left} x2={width - right} y1={y(last.close)} y2={y(last.close)}
          stroke={last.close >= last.open ? "var(--up)" : "var(--down)"} strokeOpacity={0.55} strokeDasharray="4 4" />}
        {data.candles.map((bar) => {
          const color = bar.close >= bar.open ? "var(--up)" : "var(--down)";
          const bodyWidth = Math.max(1.3, slotWidth * 0.62);
          return <g key={bar.timestamp} opacity={bar.complete ? 1 : 0.6}>
            <line x1={x(bar.slot)} x2={x(bar.slot)} y1={y(bar.high)} y2={y(bar.low)} stroke={color} strokeWidth={Math.max(1, bodyWidth * 0.2)} />
            <rect x={x(bar.slot) - bodyWidth / 2} y={Math.min(y(bar.open), y(bar.close))}
              width={bodyWidth} height={Math.max(1.2, Math.abs(y(bar.open) - y(bar.close)))} fill={color} />
          </g>;
        })}
        {levels.map((level) => <g key={level.label}>
          <title>{`${level.label} ${formatCurrency(level.value)}${level.note ? ` · ${level.note}` : ""}`}</title>
          <line x1={left} x2={width - right} y1={y(level.value)} y2={y(level.value)} stroke={level.color} strokeWidth={level.weight} strokeDasharray={level.dash} />
          <path d={`M ${width - right} ${y(level.value)} L ${width - right + 4} ${level.labelY}`} stroke={level.color} strokeOpacity={0.7} fill="none" />
          <rect x={width - right + 4} y={level.labelY - TAG_HALF} width={right - 6} height={TAG_HALF * 2} rx={3}
            fill={level.color} fillOpacity={0.16} stroke={level.color} strokeOpacity={0.55} />
          <text x={width - right + 8} y={level.labelY - 3} fill={level.color} fontSize={9} fontWeight={600} className="num">
            {level.label}
          </text>
          <text x={width - right + 8} y={level.labelY + 8} fill={level.color} fontSize={11} fontWeight={600} className="num">
            {formatCurrency(level.value)}
          </text>
        </g>)}
        {pointerPrice !== null && pointerY !== null && <line pointerEvents="none" x1={left} x2={width - right} y1={pointerY} y2={pointerY}
          stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeDasharray="3 3" />}
        {hovered && <line pointerEvents="none" x1={x(hovered.slot)} x2={x(hovered.slot)} y1={top} y2={height - bottom}
          stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeDasharray="3 3" />}
        {!last && <text x={left + plotWidth / 2} y={top + plotHeight / 2} textAnchor="middle" fill="var(--muted-foreground)" fontSize={13}>
          {pick("거래 데이터 대기 중", "Waiting for trading data")}
        </text>}
      </svg>

      <div className="pointer-events-none absolute inset-0">
        {active && <div role="status" aria-label={`${pick("시가", "Open")} ${formatCurrency(active.open)}, ${pick("고가", "High")} ${formatCurrency(active.high)}, ${pick("저가", "Low")} ${formatCurrency(active.low)}, ${pick("종가", "Close")} ${formatCurrency(active.close)}`}
          className="num absolute flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[11px] font-medium"
          style={{ left: left + 10, top: top + 4, maxWidth: plotWidth - 16 }}>
          {([
            [pick("시", "O"), active.open], [pick("고", "H"), active.high],
            [pick("저", "L"), active.low], [pick("종", "C"), active.close],
          ] as const).map(([label, value]) => <span key={label} style={{ color: active.close >= active.open ? "var(--up)" : "var(--down)" }}>
            <span className="text-muted-foreground">{label}</span> {formatCurrency(value)}
          </span>)}
          {activeChange !== null && <span style={{ color: activeChange >= 0 ? "var(--up)" : "var(--down)" }}>{formatPercent(activeChange)}</span>}
          {!active.complete && <span className="text-muted-foreground">{pick("진행 중", "In progress")}</span>}
        </div>}

        {[{ group: above, arrow: "↑", offset: { top: top + 6 } }, { group: below, arrow: "↓", offset: { bottom: bottom + 6 } }]
          .filter((side) => side.group.length > 0).map((side) => <button key={side.arrow} type="button"
            onClick={() => setFit(expandTo(side.group))}
            title={pick("축을 넓혀 표시합니다", "Widen the axis to show these")}
            className="num pointer-events-auto absolute rounded-full border border-border/70 bg-[var(--popover)]/85 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            style={{ right: right + 8, ...side.offset }}>
            {side.arrow} {pick("축 밖", "off scale")} · {side.group[0].label} {formatCurrency(side.group[0].value)}
            {side.group.length > 1 && ` +${side.group.length - 1}`}
          </button>)}

        {last && <div className="num absolute rounded-sm px-1.5 py-0.5 text-[11px] font-semibold text-[var(--background)]"
          style={{ left: width - right + 4, top: lastTagY ?? y(last.close), transform: "translateY(-50%)", background: last.close >= last.open ? "var(--up)" : "var(--down)" }}>
          {formatCurrency(last.close)}
        </div>}

        {pointerPrice !== null && pointerY !== null && <div className="num absolute rounded-sm bg-[var(--foreground)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--background)]"
          style={{ left: width - right + 4, top: pointerY, transform: "translateY(-50%)" }}>
          {formatCurrency(pointerPrice)}
        </div>}

        {hovered && <div role="tooltip" className="num absolute rounded-sm bg-[var(--foreground)] px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-[var(--background)]"
          style={{ left: Math.min(Math.max(x(hovered.slot), left + 56), left + plotWidth - 56), top: height - bottom + 7, transform: "translateX(-50%)" }}>
          {stampLabel(new Date(hovered.timestamp * 1000))}
        </div>}
      </div>
      </div>

      {gex && showGex && gexLines.length > 0 && <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[11px]">
        {gexLines.map((level) => <span key={level.id} className="inline-flex items-baseline gap-1.5">
          <span className="num font-semibold" style={{ color: level.role === "support" ? "var(--gex-support)" : "var(--gex-resistance)" }}>
            GEX {level.role === "support" ? "S" : "R"}{level.rank} {formatCurrency(level.price)}
          </span>
          <span className="text-muted-foreground">{level.role === "support" ? pick("지지 후보", "Support") : pick("저항 후보", "Resistance")}</span>
          {level.strong && <span>{pick("강한 후보", "Strong candidate")}</span>}
          {confluence(level.price, level.role) && <span className="gex-floor-tint">{pick("−1σ 합치", "−1σ confluence")}</span>}
          {!inView(level.price) && <span className="text-muted-foreground">{level.price > ceiling ? "↑" : "↓"}</span>}
        </span>)}
      </p>}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {band ? pick("가격 축은 이번 주 캔들 범위 기준이며, 화면에 σ 선이 하나도 없을 때만 가장 가까운 선까지 넓힙니다. 오른쪽 위 버튼으로 ±1σ 전체를 볼 수 있습니다.", "The price axis follows this week's candles and only stretches to the nearest σ line when none would be visible. Use the buttons above to see the full ±1σ range.") : pick("해당 주의 1σ 데이터가 없습니다. 가격 축은 주간 고가·저가 기준입니다.", "No 1σ data for this week. The price axis follows the week's highs and lows.")}
        {" "}{pick("휴장·미수신 구간은 빈칸으로 남습니다.", "Holidays and missing bars remain empty.")}
      </p>
    </div>
  );
}
