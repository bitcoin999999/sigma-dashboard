import { loadWeeklyChart } from "@/lib/weekly-chart-server";
import { chartWeek } from "@/lib/weekly-chart";
import { chartCacheSeconds } from "@/lib/weekly-chart-refresh";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const symbol = (await params).symbol.toUpperCase();
  const headers = { "Cache-Control": "no-store" };
  if (!/^[A-Z0-9^][A-Z0-9.^-]{0,11}$/.test(symbol)) {
    return Response.json({ error: "Invalid symbol" }, { status: 400, headers });
  }
  // Week in the URL keeps Monday requests out of the preceding week's CDN entry.
  const week = new URL(request.url).searchParams.get("week");
  if (week && week !== chartWeek().weekStart) {
    return Response.json({ error: "Chart week changed" }, { status: 409, headers });
  }
  try {
    const data = await loadWeeklyChart(symbol);
    const ttl = chartCacheSeconds(data.fetchedAt);
    return Response.json(data, { headers: {
      "Cache-Control": `public, max-age=${ttl}, must-revalidate`,
      "Vercel-CDN-Cache-Control": `public, s-maxage=${ttl}, must-revalidate`,
    } });
  } catch (error) {
    console.error("Weekly chart load failed:", error);
    return Response.json({ error: "Weekly chart unavailable" }, { status: 503, headers });
  }
}
