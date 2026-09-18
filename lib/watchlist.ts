export const WATCHLIST_KEY = "sigma-personal-watchlist";
export const WATCHLIST_LIMIT = 10;

/** Unknown/off-board symbols are preserved in storage until explicitly removed. */
export function normalizeSymbols(values: unknown, valid?: ReadonlySet<string>): string[] {
  if (!Array.isArray(values)) return [];
  const symbols = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const symbol = value.trim().toUpperCase();
    if (!/^[A-Z0-9.^-]{1,20}$/.test(symbol) || (valid && !valid.has(symbol))) continue;
    symbols.add(symbol);
    if (symbols.size === WATCHLIST_LIMIT) break;
  }
  return [...symbols];
}

export function toggleSymbol(symbols: string[], symbol: string): string[] {
  if (symbols.includes(symbol)) return symbols.filter((item) => item !== symbol);
  return normalizeSymbols([...symbols, symbol]);
}

export function parseStoredSymbols(raw: string | null): string[] {
  try { return normalizeSymbols(JSON.parse(raw ?? "[]")); } catch { return []; }
}
