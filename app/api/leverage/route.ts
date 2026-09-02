import { NextResponse } from "next/server";

import { LEVERAGE_SYMBOLS } from "@/lib/leverage";
import { loadLiveQuotes } from "@/lib/live-quotes";

export const dynamic = "force-dynamic";

/** Backs the calculator's refresh button: re-reads the intraday quote feed. */
export async function GET() {
  try {
    return NextResponse.json(await loadLiveQuotes(LEVERAGE_SYMBOLS));
  } catch (error) {
    console.error("Live quote load failed:", error);
    return NextResponse.json({ error: "Quotes unavailable" }, { status: 503 });
  }
}
