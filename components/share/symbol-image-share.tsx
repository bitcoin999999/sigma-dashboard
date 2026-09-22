"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale } from "@/components/locale-provider";
import { shareImageFile } from "@/lib/share-image";
import { productEvent } from "@/lib/product-events";
const button="min-h-11 rounded-xl border border-border px-4 text-sm disabled:opacity-40";
export function SymbolImageShare({symbol,imageUrl}:{symbol:string;imageUrl:string}) {
  const {pick}=useLocale(); const dialog=useRef<HTMLDialogElement>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [image,setImage]=useState<{blob:Blob;url:string}|null>(null);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>()=>{if(image)URL.revokeObjectURL(image.url);},[image]);
  async function prepare(){
    productEvent("share_image_prepare","symbol");setBusy(true);setMessage("");
    try{const response=await fetch(imageUrl);if(!response.ok||!response.headers.get("content-type")?.includes("image/png"))throw new Error();const blob=await response.blob();if(alive.current){setImage({blob,url:URL.createObjectURL(blob)});productEvent("share_image_ready","symbol");}}
    catch{if(alive.current)setMessage(pick("이미지를 준비하지 못했습니다. 다시 시도하세요.","Could not prepare the image. Try again."));}
    finally{if(alive.current)setBusy(false);}
  }
  function download(){if(!image)return;const a=document.createElement("a");a.href=image.url;a.download=`${symbol.toLowerCase()}-sigma-analysis.png`;a.click();productEvent("share_image_download","symbol");}
  async function share(){if(!image)return;const result=await shareImageFile(image.blob,symbol,navigator);if(result==="download"){setMessage(pick("파일 공유를 지원하지 않아 PNG로 저장합니다.","File sharing unavailable; saving PNG."));download();}else productEvent(result==="shared"?"share_image_share":"share_image_cancel","symbol");}
  return <><button className={button} onClick={()=>dialog.current?.showModal()}>{pick("이미지 공유","Share image")}</button><dialog ref={dialog} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-background p-5 text-foreground backdrop:bg-black/60" aria-label={pick(`${symbol} 분석 공유`,`${symbol} analysis card`)}>
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{symbol} · {pick("분석 공유","Analysis card")}</h2><button className={button} onClick={()=>dialog.current?.close()}>{pick("닫기","Close")}</button></div>
    <p className="mt-2 text-xs text-muted-foreground">1080 × 1350 · {pick("종목 요약 카드","Summary card")}</p>
    {image?<Image src={image.url} width={1080} height={1350} unoptimized alt={`${symbol} 1SIGMA`} className="mx-auto my-4 h-auto w-full max-w-64 rounded-xl"/>:<div className="my-5 flex aspect-[4/5] max-h-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">{pick("이미지를 준비해 미리보기","Prepare an image preview")}</div>}
    <p role="status" className="mb-3 text-sm">{message}</p><div className="flex flex-wrap gap-2">{!image?<button disabled={busy} onClick={prepare} className={`${button} bg-foreground text-background`}>{busy?pick("준비 중…","Preparing…"):pick("이미지 준비","Prepare image")}</button>:<><button onClick={share} className={`${button} bg-foreground text-background`}>{pick("이미지 공유","Share image")}</button><button onClick={download} className={button}>{pick("이미지 저장","Save image")}</button></>}</div>
  </dialog></>;
}
