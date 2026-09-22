import { track } from "@vercel/analytics";
export type ProductEvent = "my_sigma_summary_view" | "my_sigma_outside_filter_click" | "watchlist_change_view" |
  "share_image_prepare" | "share_image_ready" | "share_image_share" | "share_image_download" | "share_image_cancel" | "symbol_related_click";
/** Explicit allowlist: never pass symbols, holdings, money or a URL. */
export function productEvent(name: ProductEvent, surface: "my_sigma" | "home" | "symbol", counts?: { symbolCount: number; validCount: number; outsideCount?: number }) {
  try { track(name, { surface, ...(counts ? { symbolCount: counts.symbolCount, validCount: counts.validCount, ...(counts.outsideCount === undefined ? {} : { outsideCount: counts.outsideCount }) } : {}) }); } catch { /* Analytics cannot block the user's action. */ }
}
