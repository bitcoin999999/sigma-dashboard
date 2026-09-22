import { isApproachingSigma, isOutsideSigma, resolveStatus } from "./sigma";
import { isDate } from "./market-dates";
import type { WatchlistSigmaRow } from "./watchlist-summary";

export type WatchlistChange = "entered_upper_band" | "entered_lower_band" | "returned_inside" | "approaching_upper_band" | "approaching_lower_band" | "largest_sigma_move" | "new_band_window" | "data_became_available" | "data_became_unavailable";
export interface Observation { snapshotId: string; observedAt: string; bandStart: string; bandEnd: string; methodVersion: string; priceBasis: string; rows: Record<string, number | null> }
export interface Change { type: WatchlistChange; symbol?: string; before?: number | null; after?: number | null }
export function makeObservation(rows: WatchlistSigmaRow[]): Observation | null {
  const first = rows[0];
  if (!first?.snapshotId || !first.bandStart || !first.bandEnd || !first.observedAt || !first.methodVersion || !first.priceBasis) return null;
  if (rows.some(r => r.snapshotId !== first.snapshotId || r.bandStart !== first.bandStart || r.bandEnd !== first.bandEnd || r.observedAt !== first.observedAt || r.methodVersion !== first.methodVersion || r.priceBasis !== first.priceBasis)) return null;
  return { snapshotId: first.snapshotId, observedAt: first.observedAt, bandStart: first.bandStart, bandEnd: first.bandEnd,
    methodVersion: first.methodVersion, priceBasis: first.priceBasis, rows: Object.fromEntries(rows.map(r => [r.symbol, r.zScore])) };
}
export function parseObservations(raw: string): Observation[] {
  const values: unknown = JSON.parse(raw);
  if (!Array.isArray(values) || values.length > 4) throw new Error("Invalid observations");
  for (const v of values) {
    if (!v || typeof v.snapshotId !== "string" || !isDate(v.observedAt) || !isDate(v.bandStart) || !isDate(v.bandEnd) ||
      typeof v.methodVersion !== "string" || typeof v.priceBasis !== "string" || !v.rows || Array.isArray(v.rows) ||
      Object.keys(v.rows).length > 20 || Object.entries(v.rows).some(([s,z]) => !/^[A-Z0-9.^-]{1,20}$/.test(s) || (z !== null && (typeof z !== "number" || !Number.isFinite(z))))) throw new Error("Invalid observations");
  }
  return values;
}
export function compareObservations(previous: Observation | null, current: Observation) {
  const changes: Change[] = [];
  if (!previous) return { state: "first", changes };
  if (previous.snapshotId === current.snapshotId) return { state: "same", changes };
  if (previous.observedAt >= current.observedAt) return { state: "correction", changes };
  if (previous.bandStart !== current.bandStart || previous.bandEnd !== current.bandEnd) return { state: "changed", changes: [{ type: "new_band_window" }] as Change[] };
  if (previous.methodVersion !== current.methodVersion || previous.priceBasis !== current.priceBasis) return { state: "incompatible", changes };
  let largest: Change | null = null, distance = 0;
  for (const [symbol, after] of Object.entries(current.rows)) {
    if (!Object.hasOwn(previous.rows, symbol)) continue;
    const before = previous.rows[symbol];
    let type: WatchlistChange | null = null;
    if (before === null && after !== null) type = "data_became_available";
    else if (before !== null && after === null) type = "data_became_unavailable";
    else if (before !== null && after !== null) {
      if (isOutsideSigma(after) && (!isOutsideSigma(before) || Math.sign(before) !== Math.sign(after))) type = after > 0 ? "entered_upper_band" : "entered_lower_band";
      else if (isOutsideSigma(before) && resolveStatus(after) === "NORMAL") type = "returned_inside";
      else if (isApproachingSigma(after) && (!isApproachingSigma(before) || Math.sign(before) !== Math.sign(after))) type = after > 0 ? "approaching_upper_band" : "approaching_lower_band";
      if (Math.abs(after - before) > distance) { distance = Math.abs(after - before); largest = { type: "largest_sigma_move", symbol, before, after }; }
    }
    if (type) changes.push({ type, symbol, before, after });
  }
  if (largest && !changes.some(c => c.symbol === largest!.symbol)) changes.push(largest);
  return { state: "changed", changes };
}
export function rememberObservation(history: Observation[], current: Observation): Observation[] {
  // Same ID keeps the original membership: newly added symbols are not a historic data recovery.
  if (history[0]?.snapshotId === current.snapshotId) return history;
  if (history[0] && history[0].observedAt > current.observedAt) return history;
  return [current, ...history.filter(o => o.observedAt !== current.observedAt)].slice(0, 4);
}
