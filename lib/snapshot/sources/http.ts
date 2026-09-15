import { assertCalendarContext, assertSnapshotFile } from "../types";
import type { SnapshotFile, SnapshotSource } from "../types";

/** Reads the data-only static deployment. The origin CDN keeps the existing 60s TTL. */
export function httpSource(url: string, name = "http"): SnapshotSource {
  return {
    name,
    ...(name === "http" ? {
      async loadCalendarContext() {
        const response = await fetch(new URL("calendar-context.json", url).href, {
          cache: "no-store", signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error(`Calendar context returned ${response.status}`);
        const parsed: unknown = await response.json();
        assertCalendarContext(parsed);
        return parsed;
      },
    } : {}),
    async load(): Promise<SnapshotFile> {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        throw new Error(`Snapshot from ${name} returned ${response.status}: ${url}`);
      }
      const parsed: unknown = await response.json();
      assertSnapshotFile(parsed, name);
      return parsed;
    },
  };
}
