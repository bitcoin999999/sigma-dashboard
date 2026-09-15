import { NextResponse } from "next/server";
import { loadWeekCalendar } from "@/lib/econ-calendar";
import { loadCalendarContext } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const week = params.get("week") ?? "0";
    if (week !== "0" && week !== "1") {
      return NextResponse.json({ error: "Week must be 0 or 1." }, { status: 400 });
    }
    const context = await loadCalendarContext();
    // An open board must not silently switch to another band's calendar.
    const anchor = params.get("anchor");
    if (anchor && anchor !== context.anchorDate) {
      return NextResponse.json({ error: "Band changed; reload the page." }, { status: 409 });
    }
    const calendar = await loadWeekCalendar(context.anchorDate, context.symbols, week === "1" ? 1 : 0);
    if (!calendar) throw new Error("Calendar unavailable");
    return NextResponse.json(calendar, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Calendar unavailable" }, { status: 503 });
  }
}
