export interface TickerSearchItem {
  symbol: string;
  name: string;
}

/** Only names cross the header boundary, never price histories or GEX. */
export function tickerDirectory(items: readonly TickerSearchItem[]): TickerSearchItem[] {
  return [...new Map(items.map(({ symbol, name }) => [symbol, { symbol, name }])).values()]
    .sort((a, b) => a.symbol.localeCompare(b.symbol, "en"));
}

export function matchingTickers(items: readonly TickerSearchItem[], query: string): TickerSearchItem[] {
  const prefix = query.trim().toUpperCase();
  return prefix ? items.filter((item) => item.symbol.toUpperCase().startsWith(prefix)) : [];
}
