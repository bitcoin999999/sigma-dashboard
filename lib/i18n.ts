export const LOCALES = ["ko", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "sigma-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "ko" || value === "en";
}

export function resolveLocale(
  saved: unknown,
  country: string | null,
  acceptLanguage: string | null,
): Locale {
  if (isLocale(saved)) return saved;
  if (country?.toUpperCase() === "KR") return "ko";
  return /(^|,)\s*ko(?:-|;|,|$)/.test(acceptLanguage?.toLowerCase() ?? "")
    ? "ko"
    : "en";
}

export function pick(locale: Locale, ko: string, en: string): string {
  return locale === "ko" ? ko : en;
}

export const INTL_LOCALE: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en-US",
};

export const STATUS_COPY = {
  en: {
    OVERHEATED: { label: "OVERHEATED", longLabel: "Above +1.5σ", description: "More than 1.5 standard deviations above the anchor close. Statistically stretched to the upside." },
    UPPER_1SIGMA: { label: "+1σ", longLabel: "Above +1σ", description: "Broke the upper 1σ edge of its expected range but has not reached the overheated threshold." },
    NORMAL: { label: "NORMAL", longLabel: "Within ±1σ", description: "Inside the expected range. No statistical dislocation." },
    LOWER_1SIGMA: { label: "−1σ", longLabel: "Below −1σ", description: "Broke the lower 1σ edge of its expected range but has not reached the oversold threshold." },
    OVERSOLD: { label: "OVERSOLD", longLabel: "Below −1.5σ", description: "More than 1.5 standard deviations below the anchor close. Statistically stretched to the downside." },
  },
  ko: {
    OVERHEATED: { label: "OVERHEATED", longLabel: "+1.5σ 상단", description: "앵커 마감가보다 1.5σ 이상 위입니다. 통계적으로 상방 과열 구간입니다." },
    UPPER_1SIGMA: { label: "+1σ", longLabel: "+1σ 상단", description: "Expected range의 +1σ 상단을 돌파했지만 overheated 기준에는 도달하지 않았습니다." },
    NORMAL: { label: "NORMAL", longLabel: "±1σ 내부", description: "Expected range 안에 있으며 통계적 이탈이 없습니다." },
    LOWER_1SIGMA: { label: "−1σ", longLabel: "−1σ 하단", description: "Expected range의 −1σ 하단을 이탈했지만 oversold 기준에는 도달하지 않았습니다." },
    OVERSOLD: { label: "OVERSOLD", longLabel: "−1.5σ 하단", description: "앵커 마감가보다 1.5σ 이상 아래입니다. 통계적으로 하방 과매도 구간입니다." },
  },
} as const;

export const FILTER_LABELS = {
  en: { ALL: "All", NORMAL: "Normal", UPPER_1SIGMA: "+1σ", OVERHEATED: "+1.5σ Overheated", LOWER_1SIGMA: "−1σ", OVERSOLD: "−1.5σ Oversold" },
  ko: { ALL: "전체", NORMAL: "Normal", UPPER_1SIGMA: "+1σ", OVERHEATED: "+1.5σ Overheated", LOWER_1SIGMA: "−1σ", OVERSOLD: "−1.5σ Oversold" },
} as const;

export const SORT_LABELS = {
  en: { ZSCORE: "Z-Score", MOST_OVERHEATED: "Most Overheated", MOST_OVERSOLD: "Most Oversold", CHANGE: "Change %", SYMBOL: "Symbol" },
  ko: { ZSCORE: "Z-Score", MOST_OVERHEATED: "Overheated 순", MOST_OVERSOLD: "Oversold 순", CHANGE: "등락률", SYMBOL: "종목명" },
} as const;
