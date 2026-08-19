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
export function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function directionClass(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-muted-foreground";
}
