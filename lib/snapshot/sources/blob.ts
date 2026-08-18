import { assertSnapshotFile } from "../types";
import type { SnapshotFile, SnapshotSource } from "../types";

/** Blob overwrites take up to 60s to propagate, so waiting longer is pointless. */
const TIMEOUT_MS = 8_000;

/**
 * Reads the snapshot published by `tools/publish_snapshot.sh`.
 *
 * The store is public, so this needs no credentials — the URL is the whole
 * contract, and nothing secret ever reaches this process.
 *
 * `no-store` is deliberate. The blob itself is CDN-cached with a 60s max-age,
 * which is the layer that absorbs traffic; caching again in the app would just
 * stack another unknown staleness window on top of it.
 */
export function blobSource(url: string): SnapshotSource {
  return {
    name: "blob",

    async load(): Promise<SnapshotFile> {
      let response: Response;

      try {
        response = await fetch(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (cause) {
        // Network failure or timeout. There is no fallback on purpose: serving
        // a stale board as though it were current is worse than serving none.
        throw new Error(`Snapshot fetch from blob storage failed: ${url}`, {
          cause,
        });
      }

      if (!response.ok) {
        throw new Error(
          `Snapshot fetch from blob storage returned ${response.status} ` +
            `${response.statusText}: ${url}`,
        );
      }

      const parsed: unknown = await response.json();
      assertSnapshotFile(parsed, "blob storage");
      return parsed;
    },
  };
}
