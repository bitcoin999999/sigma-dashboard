"use client";

import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { locale: Locale; flag: string; label: string }[] = [
  { locale: "ko", flag: "🇰🇷", label: "한국어" },
  { locale: "en", flag: "🇺🇸", label: "English" },
];

export function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div
      role="group"
      aria-label={locale === "ko" ? "언어 선택" : "Language"}
      className="flex items-center rounded-lg border border-border/70 p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.locale === locale;
        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => !active && setLocale(option.locale)}
            aria-label={option.label}
            aria-pressed={active}
            title={option.label}
            className={cn(
              "flex size-11 md:size-7 items-center justify-center rounded-md text-base leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "bg-[color-mix(in_oklch,var(--foreground)_10%,transparent)]"
                : "opacity-45 hover:opacity-100",
            )}
          >
            <span aria-hidden>{option.flag}</span>
          </button>
        );
      })}
    </div>
  );
}
