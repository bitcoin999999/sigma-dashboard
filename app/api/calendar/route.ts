import { NextResponse } from "next/server";
import { loadWeekCalendar } from "@/lib/econ-calendar";
import { loadSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { snapshot, quotes } = await loadSnapshot();
    // An open board must not silently switch to another band's calendar.
    const anchor = new URL(request.url).searchParams.get("anchor");
    if (anchor && anchor !== snapshot.bandAnchorDate) {
      return NextResponse.json({ error: "Band changed; reload the page." }, { status: 409 });
    }
    const calendar = await loadWeekCalendar(snapshot.bandAnchorDate, quotes.map(quote => quote.symbol));
    if (!calendar) throw new Error("Calendar unavailable");
    return NextResponse.json(calendar, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Calendar unavailable" }, { status: 503 });
  }
}
