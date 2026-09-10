import "server-only";

import { cookies, headers } from "next/headers";

import { LOCALE_COOKIE, resolveLocale, type Locale } from "@/lib/i18n";

/**
 * A saved choice always wins. On a first visit Vercel's country header makes
 * Korea Korean by default; Accept-Language is the local-development fallback.
 */
export async function getRequestLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const requestHeaders = await headers();
  return resolveLocale(
    saved,
    requestHeaders.get("x-vercel-ip-country"),
    requestHeaders.get("accept-language"),
  );
}
