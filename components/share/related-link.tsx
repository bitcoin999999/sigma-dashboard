"use client";
import Link from "next/link";
import { productEvent } from "@/lib/product-events";
export function RelatedLink({symbol,children}:{symbol:string;children:React.ReactNode}) { return <Link href={`/symbol/${symbol}`} onClick={()=>productEvent("symbol_related_click","symbol")} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm hover:bg-muted/30">{children}</Link>; }
