import { httpSource } from "./http";

/** Legacy driver retained for explicit rollback; production now uses SNAPSHOT_URL. */
export function blobSource(url: string) {
  return httpSource(url, "blob");
}
