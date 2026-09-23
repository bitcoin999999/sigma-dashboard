"use client";

import { useState, useSyncExternalStore } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale } from "@/components/locale-provider";
import { formatCurrency, formatSigma } from "@/lib/format";
import type { PriceSigmaPoint } from "@/lib/market-history";
import { priceSigmaDomains } from "@/lib/price-sigma-chart";

const COLORS = { close: "#54D2D2", upper: "#A855F7", lower: "#F3D37A", sigma: "var(--foreground)" };
const mobileQuery = "(max-width: 639px)";
function subscribeMobile(listener: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;
const dollar = (value: number | null) => value === null ? "—" : formatCurrency(value);
const sigma = (value: number | null) => value === null ? "—" : formatSigma(value);

function PointReadout({ point }: { point: PriceSigmaPoint }) {
  const { pick } = useLocale();
  return <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-[11px] sm:flex sm:flex-wrap sm:items-center sm:gap-x-5" role="status">
    <span className="num self-center text-muted-foreground">{point.date}</span>
    {[
      [pick("종가", "Close"), dollar(point.close), COLORS.close],
      ["+1σ", dollar(point.upper1Sigma), COLORS.upper],
      ["−1σ", dollar(point.lower1Sigma), COLORS.lower],
      [pick("위치", "Position"), sigma(point.sigmaPosition), COLORS.sigma],
    ].map(([label, value, color]) => <span key={label} className="whitespace-nowrap"><span className="mr-1 text-muted-foreground">{label}</span><strong className="num font-medium" style={{ color }}>{value}</strong></span>)}
  </div>;
}

export function PriceSigmaOverlayChart({ data, symbol }: { data: PriceSigmaPoint[]; symbol: string }) {
  const { pick } = useLocale();
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, serverSnapshot);
  const [mobileMode, setMobileMode] = useState<"price" | "sigma">("price");
  const showPrice = !mobile || mobileMode === "price";
  const showSigma = !mobile || mobileMode === "sigma";
  const domains = priceSigmaDomains(data);
  const longRange = data.length > 90;
  const monthTicks = data.filter((row, index) => index === 0 || row.date.slice(0, 7) !== data[index - 1].date.slice(0, 7)).map(row => row.date);
  const [readoutPortal, setReadoutPortal] = useState<HTMLDivElement | null>(null);
  // A new anchor resets sigma, not the price. Do not draw a return between weeks.
  const anchors = [...new Set(data.flatMap(row => row.anchorDate ? [row.anchorDate] : []))];

  return <div className="mt-4 min-w-0">
    <div className="mt-3 flex gap-1 sm:hidden" role="group" aria-label={pick("차트 표시", "Chart view")}>
      {(["price", "sigma"] as const).map(mode => <button key={mode} type="button" aria-pressed={mobileMode === mode} onClick={() => setMobileMode(mode)} className={`min-h-11 rounded-lg px-3 text-xs ${mobileMode === mode ? "bg-foreground text-background" : "text-muted-foreground"}`}>
        {mode === "price" ? pick("가격 + 밴드", "Price + Band") : pick("σ 위치", "Sigma Position")}
      </button>)}
    </div>
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label={pick("차트 범례", "Chart legend")}>
      {(showPrice ? [[pick("종가", "Close"), COLORS.close, false], ["+1σ", COLORS.upper, true], ["−1σ", COLORS.lower, true]] as const : []).map(([label, color, dashed]) => <li key={label} className="flex items-center gap-1.5"><span className="w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />{label}</li>)}
      {showSigma && <li className="flex items-center gap-1.5"><span className="w-4 border-t" style={{ borderColor: COLORS.sigma }} />{pick("σ 위치 · 오른쪽 축", "Sigma position · right axis")}</li>}
    </ul>
    <div ref={setReadoutPortal} className="mt-3 min-h-14 sm:min-h-6" aria-label={pick("선택 날짜의 가격과 σ", "Price and sigma for selected date")} />
    <div className="mt-3 flex justify-between text-[10px] text-muted-foreground"><span>{showPrice ? pick("가격 ($)", "Price ($)") : ""}</span><span>{showSigma ? pick("위치 (σ)", "Position (σ)") : ""}</span></div>
    <div className="mt-1 h-72 min-w-0 overflow-hidden sm:h-96" aria-label={pick(`${symbol} 가격과 시그마 비교 차트`, `${symbol} price and sigma comparison chart`)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 0, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} />
          <XAxis dataKey="date" ticks={longRange ? monthTicks : undefined} tickFormatter={(value: string) => longRange ? `${value.slice(2, 4)}.${value.slice(5, 7)}` : value.slice(5).replace("-", "/")} interval="preserveStartEnd" minTickGap={40} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} padding={{ left: 5, right: 5 }} />
          <YAxis yAxisId="price" orientation="left" hide={!showPrice} domain={domains.price} width={62} tickFormatter={value => `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0 })}`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis yAxisId="sigma" orientation="right" hide={!showSigma} domain={[Math.floor(domains.sigma[0]), Math.ceil(domains.sigma[1])]} allowDecimals={false} width={52} tickFormatter={value => formatSigma(Number(value), 1)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          {readoutPortal && <Tooltip key={`${data[0]?.date}:${data.at(-1)?.date}`} portal={readoutPortal} active defaultIndex={data.length - 1} isAnimationActive={false} includeHidden wrapperStyle={{ width: "100%", pointerEvents: "none" }} content={({ label }) => {
            const point = data.find(row => row.date === label) ?? data.at(-1);
            return point ? <PointReadout point={point} /> : null;
          }} cursor={{ stroke: "var(--foreground)", strokeOpacity: 0.25, strokeDasharray: "4 4" }} />}

          {showSigma && [-1, 0, 1].map(value => <ReferenceLine key={value} yAxisId="sigma" y={value} stroke="var(--muted-foreground)" strokeOpacity={value === 0 ? 0.4 : 0.25} strokeDasharray={value === 0 ? "2 4" : "6 5"} label={{ value: formatSigma(value, 0), position: "insideTopRight", fontSize: 10, fill: "var(--muted-foreground)" }} />)}
          {showPrice && <>
            {/* A ranged Area fills only [lower, upper], never zero to upper. */}
            <Area yAxisId="price" dataKey="range" type="stepAfter" stroke="none" fill={COLORS.upper} fillOpacity={0.12} connectNulls={false} isAnimationActive={false} tooltipType="none" />
            <Line yAxisId="price" dataKey="upper1Sigma" type="stepAfter" stroke={COLORS.upper} strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line yAxisId="price" dataKey="lower1Sigma" type="stepAfter" stroke={COLORS.lower} strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line yAxisId="price" dataKey="close" type="monotone" stroke={COLORS.close} strokeWidth={2.5} dot={data.length === 1 ? { r: 3 } : false} connectNulls={false} isAnimationActive={false} />
            <Line yAxisId="price" dataKey="upperCloseTouchValue" stroke="none" dot={{ r: 3.5, fill: COLORS.upper, stroke: "var(--background)", strokeWidth: 1 }} activeDot={false} isAnimationActive={false} />
            <Line yAxisId="price" dataKey="lowerCloseTouchValue" stroke="none" dot={{ r: 3.5, fill: COLORS.lower, stroke: "var(--background)", strokeWidth: 1 }} activeDot={false} isAnimationActive={false} />
          </>}
          {showSigma && anchors.map(anchor => <Line key={anchor} yAxisId="sigma" dataKey={(row: PriceSigmaPoint) => row.anchorDate === anchor ? row.sigmaPosition : null} name="sigmaPosition" type="linear" stroke={COLORS.sigma} strokeWidth={1.3} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />)}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    {!data.length && <p className="text-xs text-muted-foreground">{pick("선택 기간의 가격 데이터가 없습니다.", "No prices in this period.")}</p>}
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{pick("음영: 당시 ±1σ · 원: 종가 기준 ±1σ 도달·돌파. 장중 고가·저가 자료가 없어 장중 터치는 표시하지 않습니다.", "Shading: historic ±1σ · dots: close at or beyond ±1σ. Intraday touches are unavailable without daily highs/lows.")}</p>
  </div>;
}
