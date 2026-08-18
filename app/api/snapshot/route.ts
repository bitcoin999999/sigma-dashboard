import { NextResponse } from "next/server";

import { loadSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

/** Backs the refresh button: re-reads the file the daily job writes. */
export async function GET() {
  return NextResponse.json(await loadSnapshot());
}
