import type { Quote, SectorEtfQuote } from "@/lib/types";

/**
 * Raw shape written by `tools/dashboard_snapshot.py` in the oi_shock repo,
 * which is the only place the weekly-σ maths lives. Nothing here recomputes σ —
 * that would fork the calculation and reintroduce a known 1.47× divergence.
 */
export interface SnapshotFile {
  /** Absent on files written before versioning; those are treated as v1. */
  schemaVersion?: number;
  generatedAt: string;
  band: {
    anchorDate: string;
    sessionDate: string;
    /** Regular sessions since the anchor. 0 on the Friday the band was struck. */
    elapsedDays: number;
    /**
     * Always false: the publisher rolls the band forward at Friday's close, so
     * what it reports is by definition a band still to be traded. Kept because
     * older snapshots carry it and dropping it would fail their parse.
     */
    settled: boolean;
  };
  quotes: Quote[];
  sectorQuotes: SectorEtfQuote[];
}

/**
 * The only contract a storage driver has to satisfy.
 *
 * This is the seam that keeps a future database migration cheap: a driver
 * returns a `SnapshotFile` and nothing above it — not `loadSnapshot`, not the
 * page, not a single component — needs to know where the bytes came from.
 */
export interface SnapshotSource {
  /** Identifies the driver in error messages, e.g. `blob` or `file`. */
  readonly name: string;
  load(): Promise<SnapshotFile>;
}

/** Bumped only when a field's meaning changes; adding fields stays on 1. */
export const SUPPORTED_SCHEMA_VERSION = 1;

/**
 * Rejects anything that is not a usable snapshot.
 *
 * Deliberately strict: this dashboard prices real money decisions, so a
 * truncated upload or an HTML error page served in place of JSON must fail
 * loudly rather than render as an empty-but-plausible board.
 */
export function assertSnapshotFile(
  value: unknown,
  origin: string,
): asserts value is SnapshotFile {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Snapshot from ${origin} is not an object.`);
  }

  const file = value as Partial<SnapshotFile>;
  const version = file.schemaVersion ?? SUPPORTED_SCHEMA_VERSION;

  if (version !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `Snapshot from ${origin} is schema v${version}, but this build only ` +
        `understands v${SUPPORTED_SCHEMA_VERSION}. Redeploy the app or ` +
        `republish a compatible snapshot.`,
    );
  }

  if (
    !file.band?.anchorDate ||
    !file.band?.sessionDate ||
    typeof file.band?.elapsedDays !== "number"
  ) {
    throw new Error(`Snapshot from ${origin} is missing its band window.`);
  }

  if (!Array.isArray(file.quotes) || !Array.isArray(file.sectorQuotes)) {
    throw new Error(`Snapshot from ${origin} is missing its quote arrays.`);
  }

  // An empty board is never a legitimate result: the generator already exits
  // non-zero when it cannot build a single band.
  if (file.quotes.length === 0) {
    throw new Error(`Snapshot from ${origin} contains no quotes.`);
  }
}
