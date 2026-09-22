import { loadBoard } from "@/lib/board";
import { renderSymbolImage } from "@/lib/symbol-image";
import { buildStockData } from "@/lib/sigma";
import { assertSnapshotFile } from "@/lib/snapshot/types";
import { snapshotPayload } from "@/lib/snapshot";
export const dynamic = "force-dynamic";
export async function GET(request: Request,{params}:{params:Promise<{symbol:string}>}) {
  const {symbol:raw}=await params;const symbol=raw.toUpperCase();
  const url=new URL(request.url), requested=url.searchParams.get("snapshot");
  const locale=url.searchParams.get("locale")==="ko"?"ko":"en";
  if(!requested||!/^[a-f0-9]{64}$/.test(requested)||!/^[A-Z0-9.^-]{1,20}$/.test(symbol))return new Response("Invalid image request",{status:400});
  try {
    const board=await loadBoard();let snapshot=board.snapshot,stock=board.all.find(s=>s.symbol===symbol);
    if(snapshot.snapshotId!==requested){
      const source=process.env.SNAPSHOT_URL;if(!source)return new Response("Image snapshot expired",{status:410});
      const response=await fetch(new URL(`revisions/${requested}.json`,source),{cache:"no-store",signal:AbortSignal.timeout(8000)});
      if(!response.ok)return new Response("Image snapshot unavailable",{status:response.status===404?410:503});
      const file:unknown=await response.json();assertSnapshotFile(file,"image revision");
      if(file.snapshotId!==requested)return new Response("Snapshot mismatch",{status:409});
      snapshot=snapshotPayload(file).snapshot;const quote=[...file.quotes,...file.sectorQuotes].find(s=>s.symbol===symbol);stock=quote?buildStockData(quote):undefined;
    }
    if(!stock)return new Response("Symbol unavailable",{status:404});
    return await renderSymbolImage(stock,snapshot,locale,url.searchParams.get("layout")==="feed");
  }catch{return new Response("Image could not be prepared",{status:503});}
}
