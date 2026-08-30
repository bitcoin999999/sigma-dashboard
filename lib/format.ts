const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const smallPriceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** Sub-$10 names need an extra digit or the σ band edges collapse visually. */
export function formatPrice(value: number): string {
  const formatter = Math.abs(value) < 10 ? smallPriceFormatter : priceFormatter;
  return formatter.format(value);
}

export function formatCurrency(value: number): string {
  return `$${formatPrice(value)}`;
}

export function formatPercent(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

/**
 * The 1σ band as a move off the anchor, e.g. "±2.4%".
 *
 * Reads `sigmaPercent` straight off the quote rather than re-deriving it from
 * the band edges: the edges are already rounded for display, and a name whose
 * anchor sits far from spot would otherwise show a width that does not match
 * the σ the rest of the page is scaled by.
 */
export function formatBandWidth(sigmaPercent: number, digits = 1): string {
  return `±${sigmaPercent.toFixed(digits)}%`;
}

export function formatSigma(zScore: number, digits = 2): string {
  const sign = zScore > 0 ? "+" : zScore < 0 ? "−" : "";
  return `${sign}${Math.abs(zScore).toFixed(digits)}σ`;
}

export function formatSignedNumber(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Magnitudes that span several orders of magnitude, e.g. gamma exposure.
 *
 * The number itself is unitless — what matters is one strike's size relative to
 * its neighbours — so a compact form carries the comparison without pretending
 * the trailing digits mean anything.
 */
export function formatCompact(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${compactFormatter.format(Math.abs(value))}`;
}

/**
 * "2026-08-18" → "Aug 18".
 *
 * Pinned to UTC on both ends. Snapshot dates are calendar labels for a US
 * trading session, not instants; parsing them in the viewer's zone would slide
 * the label a day backwards for anyone west of Greenwich.
 */
export function formatDay(iso: string, locale = "en-US"): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The band runs anchor close → next Friday close, so the window is anchor + 7d. */
export function formatBandWindow(anchorDate: string, locale = "en-US"): string {
  const end = new Date(`${anchorDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  return `${formatDay(anchorDate, locale)} – ${formatDay(end.toISOString().slice(0, 10), locale)}`;
}

const easternTimestamp = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

/**
 * An ISO instant as market time, e.g. "Aug 22, 12:40 AM EDT".
 *
 * Pinned to New York on purpose, and on both sides of hydration: the publisher
 * stamps the file in its own zone, the reader may be in a third, and the only
 * clock any of these numbers mean anything against is the one the exchange
 * runs on. Rendering it in the viewer's zone would also make the server and
 * client markup disagree.
 */
export function formatEastern(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "unknown";
  return easternTimestamp.format(at);
}

export function directionClass(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-muted-foreground";
}
