import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { symbolCardData } from "./symbol-card";
import { SITE_HOST } from "./site";
import type { StockData, MarketSnapshot } from "./types";
const font = readFile(path.join(process.cwd(),"assets/fonts/noto-share.ttf"));
export async function renderSymbolImage(stock: StockData, snapshot: MarketSnapshot, locale: "ko"|"en", feed: boolean) {
  const data = symbolCardData(stock,snapshot,locale);
  const pick = (ko:string,en:string)=>locale==="ko"?ko:en;
  const width=feed?1080:1200,height=feed?1350:630;
  const content = <div style={{width:"100%",height:"100%",display:"flex",flexDirection:"column",background:"#12151d",color:"#f2f4f8",padding:feed?"64px 68px":"46px 60px",fontFamily:"Noto",fontSize:26}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",color:"#8ab4f8",fontSize:30}}><span>1SIGMA</span><span style={{fontSize:22,color:"#9ca7bb"}}>{data.session}</span></div>
    <div style={{display:"flex",marginTop:feed?68:24,alignItems:"baseline",gap:24}}><span style={{fontSize:feed?90:60,fontWeight:500,letterSpacing:-3}}>{data.symbol}</span><span style={{fontSize:feed?28:24,color:"#9ca7bb",maxWidth:feed?550:720,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{data.name.slice(0,70)}</span></div>
    {feed&&<div style={{display:"flex",gap:22,alignItems:"center",marginTop:20}}><span style={{fontSize:58}}>{data.price}</span><span style={{color:"#a9b9d2",fontSize:32}}>{data.change}</span></div>}
    <div style={{display:"flex",flexDirection:"column",marginTop:feed?64:20,padding:feed?"36px 40px":"20px 32px",border:"1px solid #303a4c",borderRadius:22}}>
      <span style={{fontSize:22,color:"#9ca7bb"}}>{pick("현재 위치","Current position")}</span><div style={{display:"flex",alignItems:"center",gap:28,marginTop:12}}><span style={{fontSize:feed?76:56,color:"#a8c8ff"}}>{data.sigma}</span><span style={{fontSize:feed?30:26}}>{data.state}</span></div>
    </div>
    <div style={{display:"flex",flexDirection:"column",marginTop:feed?50:18}}><span style={{fontSize:22,color:"#9ca7bb"}}>{pick("이번 주 예상 가격 범위","This week’s expected range")}</span><span style={{fontSize:feed?44:32,marginTop:12}}>{data.lower} – {data.upper}</span></div>
    {feed&&<div style={{display:"flex",flexDirection:"column",gap:20,marginTop:42,fontSize:28}}>{[[pick("기준 가격","Anchor close"),data.anchor],["GEX "+pick("지지","support"),data.support],["GEX "+pick("저항","resistance"),data.resistance]].filter(([,v])=>v).map(([label,value])=><div key={label} style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"#9ca7bb"}}>{label}</span><span>{value}</span></div>)}</div>}
    <div style={{display:"flex",flexDirection:"column",marginTop:"auto",paddingTop:feed?28:16,color:"#9ca7bb",fontSize:feed?23:18,gap:feed?8:2}}><span>{data.session} {pick("미국 정규장 종가","US regular-session close")}</span>{feed&&<span>{pick("밴드 기간","Band window")} {data.window}</span>}{feed&&<span style={{fontSize:21,marginTop:20}}>{pick("통계적 참고 정보이며 향후 가격 방향을 보장하지 않습니다.","Statistical reference; future price direction is not guaranteed.")}</span>}<span style={{marginTop:feed?26:0,fontSize:20}}>{SITE_HOST}</span></div>
  </div>;
  const bytes = await font;
  return new ImageResponse(content,{width,height,fonts:[{name:"Noto",data:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,weight:500,style:"normal"}],headers:{"Cache-Control":"public, max-age=3600"}});
}
