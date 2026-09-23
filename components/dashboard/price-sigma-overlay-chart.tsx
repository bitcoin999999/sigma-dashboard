"use client";

import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale } from "@/components/locale-provider";
import { formatCurrency, formatSigma } from "@/lib/format";
import type { PriceSigmaPoint } from "@/lib/market-history";
import { priceSigmaDomains } from "@/lib/price-sigma-chart";

const COLORS = { close: "#54D2D2", upper: "#A855F7", lower: "#F3D37A", sigma: "var(--foreground)" };
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
  const domains = priceSigmaDomains(data);
  const longRange = data.length > 90;
  const monthTicks = data.filter((row, index) => index === 0 || row.date.slice(0, 7) !== data[index - 1].date.slice(0, 7)).map(row => row.date);
  const [readoutPortal, setReadoutPortal] = useState<HTMLDivElement | null>(null);
  const syncId = `history-${symbol}-${data[0]?.date}-${data.at(-1)?.date}`;
  const axis = { dataKey: "date", ticks: longRange ? monthTicks : undefined,
    tickFormatter: (value: string) => longRange ? `${value.slice(2, 4)}.${value.slice(5, 7)}` : value.slice(5).replace("-", "/"),
    minTickGap: 40, tick: { fontSize: 11, fill: "var(--muted-foreground)" }, tickLine: false, axisLine: false,
    padding: { left: 5, right: 5 } };
  const cursor = { stroke: "var(--foreground)", strokeOpacity: 0.25, strokeDasharray: "4 4" };
  const margin = { top: 10, right: 10, bottom: 0, left: 0 };

  return <div className="mt-4 min-w-0">
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label={pick("가격 차트 범례", "Price chart legend")}>
      {([[pick("종가", "Close"), COLORS.close, false], ["+1σ", COLORS.upper, true], ["−1σ", COLORS.lower, true]] as const).map(([label, color, dashed]) => <li key={label} className="flex items-center gap-1.5"><span className="w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />{label}</li>)}
    </ul>
    <div ref={setReadoutPortal} className="mt-3 min-h-14 sm:min-h-6" aria-label={pick("선택 날짜의 가격과 σ", "Price and sigma for selected date")} />
    <p className="mt-2 text-[10px] text-muted-foreground">{pick("가격 ($)", "Price ($)")}</p>
    <div className="mt-1 h-64 min-w-0 overflow-hidden sm:h-80" aria-label={pick(`${symbol} 가격과 주간 밴드 차트`, `${symbol} price and weekly band chart`)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart key={`${syncId}-price`} data={data} syncId={syncId} syncMethod="value" margin={margin} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} />
          <XAxis {...axis} interval="preserveStartEnd" />
          <YAxis domain={domains.price} width={62} tickFormatter={value => `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0 })}`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          {readoutPortal && <Tooltip portal={readoutPortal} active defaultIndex={data.length - 1} isAnimationActive={false} wrapperStyle={{ width: "100%", pointerEvents: "none" }} content={({ label }) => {
            const point = data.find(row => row.date === label) ?? data.at(-1);
            return point ? <PointReadout point={point} /> : null;
          }} cursor={cursor} />}
          <Area dataKey="range" type="stepAfter" stroke="none" fill={COLORS.upper} fillOpacity={0.12} connectNulls={false} isAnimationActive={false} tooltipType="none" />
          <Line dataKey="upper1Sigma" type="stepAfter" stroke={COLORS.upper} strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="lower1Sigma" type="stepAfter" stroke={COLORS.lower} strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="close" type="monotone" stroke={COLORS.close} strokeWidth={2.5} dot={data.length === 1 ? { r: 3 } : false} connectNulls={false} isAnimationActive={false} />
          <Line dataKey="upperCloseTouchValue" stroke="none" dot={{ r: 3, fill: COLORS.upper, stroke: "var(--background)", strokeWidth: 1 }} activeDot={false} isAnimationActive={false} />
          <Line dataKey="lowerCloseTouchValue" stroke="none" dot={{ r: 3, fill: COLORS.lower, stroke: "var(--background)", strokeWidth: 1 }} activeDot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <p className="mt-2 text-[11px] text-muted-foreground">{pick("음영: 당시 ±1σ · 원: 종가 기준 도달·돌파", "Shading: historic ±1σ · dots: close at or beyond the band")}</p>
    <div className="mt-5 border-t border-border/50 pt-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h3 className="text-sm font-medium">{pick("σ 위치", "Sigma position")}</h3><span className="text-[11px] text-muted-foreground">{pick("주간 앵커 기준", "Relative to the weekly anchor")}</span></div>
      <div className="mt-2 h-40 min-w-0 overflow-hidden sm:h-48" aria-label={pick(`${symbol} 시그마 위치 차트`, `${symbol} sigma position chart`)}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart key={`${syncId}-sigma`} data={data} syncId={syncId} syncMethod="value" margin={margin} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.3} />
            <XAxis {...axis} interval="preserveStartEnd" />
            <YAxis domain={[Math.floor(domains.sigma[0]), Math.ceil(domains.sigma[1])]} allowDecimals={false} width={62} tickFormatter={value => formatSigma(Number(value), 0)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip active defaultIndex={data.length - 1} isAnimationActive={false} content={() => null} cursor={cursor} />
            {[-1, 0, 1].map(value => <ReferenceLine key={value} y={value} stroke={value > 0 ? COLORS.upper : value < 0 ? COLORS.lower : "var(--muted-foreground)"} strokeOpacity={0.5} strokeDasharray="4 4" />)}
            {/* Join observed daily positions across weeks; missing observations remain gaps. */}
            <Line dataKey="sigmaPosition" name="sigmaPosition" type="monotone" stroke={COLORS.sigma} strokeWidth={1.8} dot={data.length <= 65 ? { r: 2 } : false} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
    {!data.length && <p className="text-xs text-muted-foreground">{pick("선택 기간의 가격 데이터가 없습니다.", "No prices in this period.")}</p>}
  </div>;
}
