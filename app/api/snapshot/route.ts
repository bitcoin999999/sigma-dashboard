import { NextResponse } from "next/server";

import { loadSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

/** Backs the refresh button: re-reads the snapshot the daily job publishes. */
export async function GET() {
  try {
    return NextResponse.json(await loadSnapshot());
  } catch (error) {
    console.error("Snapshot load failed:", error);
    // 503 rather than a thrown 500, so the caller gets a machine-readable
    // "temporarily unavailable" instead of an HTML error page it would try to
    // parse as a snapshot. Still no fallback to the committed seed.
    return NextResponse.json(
      { error: "Market data unavailable" },
      { status: 503 },
    );
  }
}
