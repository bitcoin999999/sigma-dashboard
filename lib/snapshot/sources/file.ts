import { readFile } from "node:fs/promises";
import path from "node:path";

import { assertSnapshotFile } from "../types";
import type { SnapshotFile, SnapshotSource } from "../types";

const SNAPSHOT_PATH = path.join(process.cwd(), "data", "snapshot.json");

/**
 * Local development seed only.
 *
 * `data/snapshot.json` is committed so `next dev` works offline and without
 * blob credentials. It is never a production fallback — the copy in git ages
 * out within a week of the band it describes, and quietly serving it would
 * present week-old prices as current.
 */
export function fileSource(): SnapshotSource {
  return {
    name: "file",

    async load(): Promise<SnapshotFile> {
      // Explicit local fixture override is not a deployment asset. Keep the normal
      // seed statically traceable; never include arbitrary local files in Vercel.
      const raw = process.env.SNAPSHOT_FILE
        ? await readFile(/* turbopackIgnore: true */ process.env.SNAPSHOT_FILE, "utf8")
        : await readFile(SNAPSHOT_PATH, "utf8");
      const parsed: unknown = JSON.parse(raw);
      assertSnapshotFile(parsed, SNAPSHOT_PATH);
      return parsed;
    },
  };
}
