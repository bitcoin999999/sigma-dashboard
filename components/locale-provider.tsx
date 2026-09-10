"use client";

import * as React from "react";

import {
  LOCALE_COOKIE,
  type Locale,
  pick as pickLocale,
} from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  pick: (ko: string, en: string) => string;
}

const LocaleContext = React.createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, updateLocale] = React.useState(initialLocale);

  const setLocale = React.useCallback((next: Locale) => {
    updateLocale(next);
    document.documentElement.lang = next;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;

    // Server-rendered detail and screener pages read the same cookie. Reloading
    // keeps their metadata and body in lockstep with the client-side surfaces.
    window.location.reload();
  }, []);

  const value = React.useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      pick: (ko, en) => pickLocale(locale, ko, en),
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const value = React.useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}
