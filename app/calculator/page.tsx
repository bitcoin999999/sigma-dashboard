import type { Metadata } from "next";

import { LeverageCalculator } from "@/components/calculator/leverage-calculator";
import { loadBoard } from "@/lib/board";
import { LEVERAGE_SYMBOLS } from "@/lib/leverage";
import { loadLiveQuotes } from "@/lib/live-quotes";
import type { LiveQuotes } from "@/lib/live-quotes";
import { SITE_NAME } from "@/lib/site";

/** Prices here are intraday, so this page is never prerendered or cached. */
export const dynamic = "force-dynamic";

const TITLE = "Leverage Calculator · QQQ to TQQQ, SQQQ and QLD";
const DESCRIPTION =
  "Read a level off QQQ, SPY, SOXX, DRAM, IWM or DIA and see where the 2× and 3× funds written on it trade when it gets there — TQQQ, SQQQ, QLD, UPRO, SOXL, RAM and the rest, priced off live quotes.";

export const metadata: Metadata = {
  title: `${TITLE} · ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: "/calculator" },
  openGraph: {
    type: "website",
    url: "/calculator",
    title: `${TITLE} · ${SITE_NAME}`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} · ${SITE_NAME}`,
    description: DESCRIPTION,
  },
};

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
