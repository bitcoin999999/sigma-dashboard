import { findStock, loadBoard } from "@/lib/board";
import { loadMarketHistory } from "@/lib/market-history-server";
export async function GET(_: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const stock = await findStock(symbol);
  if (!stock) return Response.json({ error: "Symbol unavailable" },{status:404});
  return Response.json(await loadMarketHistory(stock,(await loadBoard()).snapshot));
}
