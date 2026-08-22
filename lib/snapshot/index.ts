import { formatDay } from "@/lib/format";
import type { MarketSnapshot, Quote, SectorEtfQuote } from "@/lib/types";

import { blobSource } from "./sources/blob";
import { fileSource } from "./sources/file";
import type { SnapshotFile, SnapshotSource } from "./types";

export type { SnapshotFile, SnapshotSource } from "./types";

export interface SnapshotPayload {
  quotes: Quote[];
  sectorQuotes: SectorEtfQuote[];
  snapshot: MarketSnapshot;
}

/** The band runs anchor close → next Friday close, so the window is anchor + 7d. */
function bandWindow(anchorDate: string): string {
  const end = new Date(`${anchorDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  return `${formatDay(anchorDate)} – ${formatDay(end.toISOString().slice(0, 10))}`;
}

/**
 * Picks the storage driver from the environment.
 *
 * Adding a database later means one more branch here plus a `sources/db.ts` —
 * `loadSnapshot` and everything above it stay untouched.
 */
function resolveSource(): SnapshotSource {
  const requested = process.env.SNAPSHOT_SOURCE?.trim().toLowerCase();
  const url = process.env.SNAPSHOT_BLOB_URL?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (requested === "blob" || (!requested && url)) {
    if (!url) {
      throw new Error(
        "SNAPSHOT_SOURCE=blob requires SNAPSHOT_BLOB_URL to be set.",
      );
    }
    return blobSource(url);
  }

  // The committed seed is a development convenience. Reaching for it in a
  // production build almost always means SNAPSHOT_BLOB_URL failed to reach the
  // deployment, and silently serving a stale board is the one outcome worth
  // crashing to avoid. Opting in explicitly is still allowed.
  if (isProduction && requested !== "file") {
    throw new Error(
      "No snapshot source configured: set SNAPSHOT_BLOB_URL. Refusing to " +
        "serve the committed development seed in production, because it " +
        "would present stale prices as current.",
    );
  }

  return fileSource();
}

/**
 * The stable contract for the whole app.
 *
 * `app/page.tsx` and `app/api/snapshot/route.ts` call this and nothing else,
 * which is what makes the storage layer swappable without touching the UI.
 */
export async function loadSnapshot(): Promise<SnapshotPayload> {
  const source = resolveSource();
  const file: SnapshotFile = await source.load();

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
      bandElapsed: file.band.elapsedDays,
    },
  };
}
