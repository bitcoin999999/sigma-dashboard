"use client";

import { useLocale } from "@/components/locale-provider";
import { CLASSIFICATION_LABELS, classificationOptions, EMPTY_CLASSIFICATION_FILTERS, type ClassifiedSymbol, type ClassificationFilters as Filters } from "@/lib/classification";

export function ClassificationFilters({ stocks, value, onChange }: {
  stocks: readonly ClassifiedSymbol[];
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const { pick } = useLocale();
  const options = classificationOptions(stocks);
  const fields: [keyof Filters, string, string][] = [
    ["sector", "섹터", "Sector"], ["theme", "테마", "Theme"],
    ["region", "지역", "Region"], ["assetClass", "유형", "Type"],
  ];
  return <div className="flex flex-wrap items-end gap-2" role="group" aria-label={pick("종목 분류 필터", "Symbol classification filters")}>
    {fields.map(([key, ko, en]) => <label key={key} className="min-w-0 flex-[1_1_140px] text-xs text-muted-foreground md:flex-none">
      <span className="mb-1 block">{pick(ko, en)}</span>
      <select value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })}
        className="h-11 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-sm text-foreground md:w-48 focus-visible:outline-2 focus-visible:outline-ring">
        <option value="">{pick("전체", "All")}</option>
        {options[key].map(option => <option key={option} value={option}>{CLASSIFICATION_LABELS[option] ? pick(...CLASSIFICATION_LABELS[option]) : option}</option>)}
      </select>
    </label>)}
    {Object.values(value).some(Boolean) && <button type="button" onClick={() => onChange({ ...EMPTY_CLASSIFICATION_FILTERS })}
      className="min-h-11 rounded-lg border border-border px-3 text-xs text-muted-foreground">{pick("분류 초기화", "Reset classification")}</button>}
  </div>;
}
