"use client";

import {
  Area,
  AreaChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  YAxis,
} from "recharts";

import { formatCurrency } from "@/lib/format";
import type { StockData } from "@/lib/types";

export function PriceChart({ stock }: { stock: StockData }) {
  const data = stock.history.map((bar) => ({
    date: bar.date,
    price: bar.close,
  }));
  const prices = data.map((point) => point.price);
  const low = Math.min(...prices, stock.sigmaExtremeLower);
  const high = Math.max(...prices, stock.sigmaExtremeUpper);
  const pad = (high - low) * 0.12;

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="sigma-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--state)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--state)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <YAxis domain={[low - pad, high + pad]} hide />

          <ReferenceArea
            y1={stock.sigma1Lower}
            y2={stock.sigma1Upper}
            fill="var(--foreground)"
            fillOpacity={0.045}
            stroke="none"
          />
          <ReferenceLine
            y={stock.sigmaExtremeUpper}
            stroke="var(--sigma-hot)"
            strokeOpacity={0.5}
            strokeDasharray="3 4"
          />
          <ReferenceLine
            y={stock.sigmaExtremeLower}
            stroke="var(--sigma-cold)"
            strokeOpacity={0.5}
            strokeDasharray="3 4"
          />
          <ReferenceLine
            y={stock.anchor}
            stroke="var(--foreground)"
            strokeOpacity={0.35}
            strokeDasharray="2 4"
            label={{
              value: `Anchor ${formatCurrency(stock.anchor)}`,
              position: "insideTopLeft",
              fill: "var(--muted-foreground)",
              fontSize: 10,
            }}
          />

          <Area
            type="monotone"
            dataKey="price"
            stroke="var(--state)"
            strokeWidth={1.75}
            fill="url(#sigma-area)"
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
