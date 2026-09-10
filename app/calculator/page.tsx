import type { Metadata } from "next";

import { LeverageCalculator } from "@/components/calculator/leverage-calculator";
import { loadBoard } from "@/lib/board";
import { LEVERAGE_SYMBOLS } from "@/lib/leverage";
import { loadLiveQuotes } from "@/lib/live-quotes";
import type { LiveQuotes } from "@/lib/live-quotes";
import { SITE_NAME } from "@/lib/site";
import { getRequestLocale } from "@/lib/i18n-server";

/** Prices here are intraday, so this page is never prerendered or cached. */
export const dynamic = "force-dynamic";

const TITLE = "Leverage Calculator · QQQ to TQQQ, SQQQ and QLD";
const DESCRIPTION =
  "Read a level off QQQ, SPY, SOXX, DRAM, IWM or DIA and see where the 2× and 3× funds written on it trade when it gets there — TQQQ, SQQQ, QLD, UPRO, SOXL, RAM and the rest, priced off live quotes.";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const title = locale === "ko" ? `레버리지 계산기 · QQQ·TQQQ·SQQQ·QLD · ${SITE_NAME}` : `${TITLE} · ${SITE_NAME}`;
  const description = locale === "ko" ? "QQQ, SPY, SOXX, DRAM, IWM, DIA의 목표 레벨을 입력하고 2×·3× 레버리지 ETF의 예상 가격을 실시간 시세로 계산합니다." : DESCRIPTION;
  return {
  title,
  description,
  alternates: { canonical: "/calculator" },
  openGraph: {
    type: "website",
    url: "/calculator",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  };
}

export default async function CalculatorPage() {
  // The board is only here for the shared chrome. A quote feed outage must not
  // take the page down with it — the calculator says so itself and offers a
  // retry, which is more use than an error screen.
  const [{ snapshot }, quotes] = await Promise.all([
    loadBoard(),
    loadLiveQuotes(LEVERAGE_SYMBOLS).catch(
      (error: unknown): LiveQuotes | null => {
        console.error("Live quote load failed:", error);
        return null;
      },
    ),
  ]);

  return <LeverageCalculator snapshot={snapshot} initialQuotes={quotes} />;
}
