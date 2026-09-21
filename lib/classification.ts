/** Classification values arrive in the snapshot; the producer owns ticker mappings. */
export type AssetClass = "equity" | "etf" | "unknown";
export type Region = "US" | "China" | "Korea" | "Global" | "Unknown";
/** User-curated display groups; broad sector names remain for the SPDR ETF monitor. */
export type Sector = "Benchmarks & ETF" | "Mega Cap" | "Defensive" | "Semiconductors"
  | "Software" | "Optical" | "Neocloud" | "Space" | "Quantum" | "Power"
  | "China ADR" | "Materials & Commodities" | "Crypto" | "Networking" | "Industrials & Defense"
  | "Technology" | "Communication Services" | "Consumer Discretionary"
  | "Consumer Staples" | "Healthcare" | "Financials" | "Industrials" | "Energy"
  | "Utilities" | "Real Estate" | "Materials" | "Broad Market" | "Unclassified";

export interface SymbolClassification {
  assetClass: AssetClass;
  sector: Sector;
  themes: string[];
  region: Region;
}

// Optional fields keep pre-classification snapshots readable during deployment.
export interface ClassifiedSymbol {
  sector: string;
  assetClass?: AssetClass;
  themes?: string[];
  region?: Region;
}

export type ClassificationFilters = { sector: string; theme: string; assetClass: string; region: string };
export const EMPTY_CLASSIFICATION_FILTERS: ClassificationFilters = { sector: "", theme: "", assetClass: "", region: "" };

export function matchesClassification(stock: ClassifiedSymbol, filters: ClassificationFilters): boolean {
  return (!filters.sector || stock.sector === filters.sector)
    && (!filters.theme || stock.themes?.includes(filters.theme) === true)
    && (!filters.assetClass || (stock.assetClass ?? "unknown") === filters.assetClass)
    && (!filters.region || (stock.region ?? "Unknown") === filters.region);
}

export function classificationOptions(stocks: readonly ClassifiedSymbol[]) {
  const sorted = (items: string[]) => [...new Set(items)].filter(Boolean).sort((a, b) => a.localeCompare(b));
  return {
    sector: sorted(stocks.map(stock => stock.sector)),
    theme: sorted(stocks.flatMap(stock => stock.themes ?? [])),
    assetClass: sorted(stocks.map(stock => stock.assetClass ?? "unknown")),
    region: sorted(stocks.map(stock => stock.region ?? "Unknown")),
  };
}

export const CLASSIFICATION_LABELS: Record<string, [string, string]> = {
  "Benchmarks & ETF": ["지수·ETF", "Benchmarks & ETF"], "Mega Cap": ["대형 기술주", "Mega Cap"],
  Defensive: ["경기방어주", "Defensive"], Semiconductors: ["반도체", "Semiconductors"],
  Software: ["소프트웨어", "Software"], Optical: ["광통신", "Optical"], Neocloud: ["네오클라우드", "Neocloud"],
  Space: ["우주", "Space"], Quantum: ["양자컴퓨팅", "Quantum"], Power: ["전력", "Power"],
  "China ADR": ["중국 ADR", "China ADR"], "Materials & Commodities": ["소재·원자재", "Materials & Commodities"],
  Crypto: ["크립토", "Crypto"], Networking: ["네트워킹", "Networking"],
  "Industrials & Defense": ["산업재·방산", "Industrials & Defense"],
  equity: ["개별주", "Equity"], etf: ["ETF", "ETF"], unknown: ["유형 미분류", "Unknown type"],
  US: ["미국", "US"], China: ["중국", "China"], Korea: ["한국", "Korea"],
  Global: ["글로벌·기타 지역", "Global / other regions"], Unknown: ["지역 미분류", "Unknown region"],
  Technology: ["기술", "Technology"], "Communication Services": ["커뮤니케이션", "Communication Services"],
  "Consumer Discretionary": ["경기소비재", "Consumer Discretionary"], "Consumer Staples": ["필수소비재", "Consumer Staples"],
  Healthcare: ["헬스케어", "Healthcare"], Financials: ["금융", "Financials"], Industrials: ["산업재", "Industrials"],
  Energy: ["에너지", "Energy"], Utilities: ["유틸리티", "Utilities"], "Real Estate": ["부동산", "Real Estate"],
  Materials: ["소재", "Materials"], "Broad Market": ["시장·다중 섹터", "Broad Market"], Unclassified: ["섹터 미분류", "Unclassified"],
};
