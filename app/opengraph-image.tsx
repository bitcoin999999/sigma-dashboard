import { ImageResponse } from "next/og";

import { loadBoard } from "@/lib/board";
import { formatEastern, formatSigma } from "@/lib/format";
import { SIGMA_1, summarize } from "@/lib/sigma";
import { SITE_HOST, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} · ${SITE_TAGLINE}`;
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

/**
 * The share card for the board itself.
 *
 * It reports the same counts the page leads with rather than a static logo:
 * the link is shared for what the market did today, and a card that never
 * changes gives a reader no reason to follow it twice.
 */
export default async function Image() {
  const { snapshot, all } = await loadBoard();
  const counts = summarize(all);

  const past1 = all.filter((stock) => Math.abs(stock.zScore) >= SIGMA_1);
  const furthest = [...all]
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    .slice(0, 5);

  const tiles = [
    { label: "Past +1σ", value: counts.beyondUpper1, tone: UP },
    { label: "Past −1σ", value: counts.beyondLower1, tone: DOWN },
    { label: "Inside range", value: counts.normal, tone: INK },
    { label: "Symbols", value: counts.total, tone: MUTED },
  ];

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
            · {SITE_TAGLINE}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: -1.8,
          }}
        >
          Where the market sits inside its own range.
        </div>

        <div
          style={{ display: "flex", marginTop: 14, fontSize: 22, color: MUTED }}
        >
          {snapshot.bandElapsed === 0
            ? `Band struck for ${snapshot.bandWindow} — every symbol sits at its anchor until Monday trades`
            : `${past1.length} of ${counts.total} symbols outside their own weekly implied range`}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {tiles.map((tile) => (
          <div
            key={tile.label}
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: 8,
              padding: "20px 24px",
              borderRadius: 16,
              border: `1px solid ${HAIRLINE}`,
            }}
          >
            <div style={{ display: "flex", fontSize: 17, color: MUTED }}>
              {tile.label}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 44,
                fontWeight: 700,
                letterSpacing: -1.2,
                color: tile.tone,
              }}
            >
              {tile.value}
            </div>
          </div>
        ))}
      </div>

      {/* On the day the band is struck every z is zero by construction, and a
          row of `0.00σ` pills says nothing the subhead has not already said. */}
      <div style={{ display: "flex", gap: 12 }}>
        {(snapshot.bandElapsed === 0 ? [] : furthest).map((stock) => (
          <div
            key={stock.symbol}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              border: `1px solid ${HAIRLINE}`,
            }}
          >
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700 }}>
              {stock.symbol}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 20,
                fontWeight: 600,
                // A flat zero is the whole board on the day the band is struck;
                // colouring it green would read as "above the band".
                color:
                  stock.zScore === 0 ? MUTED : stock.zScore > 0 ? UP : DOWN,
              }}
            >
              {formatSigma(stock.zScore)}
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
          Band window {snapshot.bandWindow} · published{" "}
          {formatEastern(snapshot.generatedAt)}
        </div>
      </div>
    </div>,
    size,
  );
}
