import { ImageResponse } from "next/og";

import { loadBoard } from "@/lib/board";
import { buildDailyDigest, isCalendarDate } from "@/lib/daily";
import {
  formatBandWidth,
  formatCurrency,
  formatDay,
  formatEastern,
  formatPercent,
  formatSigma,
} from "@/lib/format";
import { SITE_HOST, SITE_NAME } from "@/lib/site";

export const alt = "1SIGMA daily range card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The snapshot file is rewritten out of band by the daily job, so never cache it. */
export const dynamic = "force-dynamic";

/**
 * Hex rather than the site's oklch custom properties: this image is rasterised
 * by satori, outside any browser, and nothing here can read a stylesheet.
 */
const INK = "#f2f4f8";
const MUTED = "#8b93a5";
const BACKDROP = "#12151d";
const HAIRLINE = "#252b38";
const UP = "#34d399";
const DOWN = "#f87171";
const ACCENT = "#8ab4f8";

export default async function Image({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  if (!isCalendarDate(date)) {
    return new Response(null, { status: 404 });
  }

  const { snapshot, all } = await loadBoard();

  // Same rule as the page: one snapshot exists, so a card for any other date
  // would be today's numbers under yesterday's headline.
  if (snapshot.sessionDate !== date) {
    return new Response(null, { status: 404 });
  }

  const digest = buildDailyDigest(all, snapshot.bandElapsed);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: BACKDROP,
        color: INK,
        padding: "56px 64px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: ACCENT,
              color: BACKDROP,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            σ
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: -0.4,
            }}
          >
            {SITE_NAME}
          </div>
          <div style={{ display: "flex", fontSize: 20, color: MUTED }}>
            · {formatDay(date)} close
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: 52,
            fontWeight: 700,
            letterSpacing: -1.6,
          }}
        >
          {digest.heading}
        </div>

        <div
          style={{ display: "flex", marginTop: 12, fontSize: 22, color: MUTED }}
        >
          {digest.subheading}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {digest.stocks.map((stock) => (
          <div
            key={stock.symbol}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "14px 0",
              borderTop: `1px solid ${HAIRLINE}`,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 132,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: -0.8,
              }}
            >
              {stock.symbol}
            </div>
            <div
              style={{
                display: "flex",
                flex: 1,
                fontSize: 19,
                color: MUTED,
                overflow: "hidden",
              }}
            >
              {stock.name}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                width: 130,
                fontSize: 22,
                fontWeight: 600,
                color: stock.changePercent >= 0 ? UP : DOWN,
              }}
            >
              {formatPercent(stock.changePercent)}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                width: 110,
                fontSize: 22,
                fontWeight: 700,
                // A flat zero is the whole board on the day the band is struck;
                // colouring it green would read as "above the band".
                color:
                  stock.zScore === 0 ? MUTED : stock.zScore > 0 ? UP : DOWN,
              }}
            >
              {formatSigma(stock.zScore)}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                width: 280,
                fontSize: 19,
                color: MUTED,
              }}
            >
              {formatCurrency(stock.sigma1Lower)} –{" "}
              {formatCurrency(stock.sigma1Upper)}{" "}
              {formatBandWidth(stock.sigmaPercent)}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${HAIRLINE}`,
          paddingTop: 20,
          fontSize: 18,
          color: MUTED,
        }}
      >
        <div style={{ display: "flex" }}>{SITE_HOST}</div>
        <div style={{ display: "flex" }}>
          Regular-session close, {formatDay(date)} · published{" "}
          {formatEastern(snapshot.generatedAt)}
        </div>
      </div>
    </div>,
    size,
  );
}
