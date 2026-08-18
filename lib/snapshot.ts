import { readFile } from "node:fs/promises";
import path from "node:path";

import type { MarketSnapshot, Quote, SectorEtfQuote } from "@/lib/types";

/**
 * Shape written by `tools/dashboard_snapshot.py` in the oi_shock repo, which
 * is the only place the weekly-σ maths lives. Nothing here recomputes σ —
 * that would fork the calculation and reintroduce a known 1.47× divergence.
 */
interface SnapshotFile {
  generatedAt: string;
  band: {
    anchorDate: string;
    sessionDate: string;
    elapsedDays: number;
    settled: boolean;
  };
  quotes: Quote[];
  sectorQuotes: SectorEtfQuote[];
}

export interface SnapshotPayload {
  quotes: Quote[];
  sectorQuotes: SectorEtfQuote[];
  snapshot: MarketSnapshot;
}

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "snapshot.json");

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The band runs anchor close → next Friday close, so the window is anchor + 7d. */
function bandWindow(anchorDate: string): string {
  const end = new Date(`${anchorDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  return `${formatDay(anchorDate)} – ${formatDay(end.toISOString().slice(0, 10))}`;
}

export async function loadSnapshot(): Promise<SnapshotPayload> {
  const file = JSON.parse(
    await readFile(SNAPSHOT_PATH, "utf8"),
  ) as SnapshotFile;

  return {
    quotes: file.quotes,
    sectorQuotes: file.sectorQuotes,
    snapshot: {
      // Every figure is a settled regular-session close — there is no
      // intraday path here, so the market is never "open" from this page.
      session: "CLOSED",
      updatedAt: `${formatDay(file.band.sessionDate)} close`,
      bandAnchor: `${formatDay(file.band.anchorDate)} close`,
      bandWindow: bandWindow(file.band.anchorDate),
      settled: file.band.settled,
    },
  };
}
