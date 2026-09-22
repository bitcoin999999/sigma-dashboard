import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n";
import { loadSnapshot } from "@/lib/snapshot";

/** Resolve existence before React streaming commits HTTP 200. No redirect or cache-policy change. */
export async function proxy(request: NextRequest) {
  try {
    const symbol = decodeURIComponent(request.nextUrl.pathname.split("/")[2] ?? "").toUpperCase();
    const { quotes, sectorQuotes } = await loadSnapshot();
    if ([...quotes,...sectorQuotes].some(q=>q.symbol===symbol)) return NextResponse.next();
    const ko = resolveLocale(request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get("x-vercel-ip-country"), request.headers.get("accept-language")) === "ko";
    return new NextResponse(`<!doctype html><html lang="${ko?"ko":"en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>404 · 1SIGMA</title></head><body style="font-family:system-ui;padding:10vh 8vw;background:#12151d;color:#f2f4f8"><h1>404</h1><p>${ko?"현재 제공하는 종목이 아닙니다.":"This symbol is not available."}</p><a style="color:#8ab4f8" href="/">${ko?"종목 목록으로":"View symbols"}</a></body></html>`, {status:404,headers:{"Content-Type":"text/html; charset=utf-8"}});
  } catch { return new NextResponse("Market data unavailable",{status:503}); }
}
export const config = { matcher: "/symbol/:symbol" };
