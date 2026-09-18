"use client";

import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { copyLink, shareLink, type ShareResult } from "@/lib/share";
import { SITE_URL } from "@/lib/site";

export function SymbolShare({ symbol }: { symbol: string }) {
  const { pick } = useLocale();
  const [result, setResult] = useState<ShareResult | null>(null);
  const [busy, setBusy] = useState(false);
  const url = `${SITE_URL}/symbol/${encodeURIComponent(symbol)}`;
  async function run(copy: boolean) {
    setBusy(true); setResult(null);
    try {
      setResult(await (copy ? copyLink(url, navigator) : shareLink({ title: `${symbol} | 1SIGMA`, text: pick(`${symbol}의 최신 주간 σ 범위와 차트`, `${symbol}: latest weekly sigma range and chart`), url }, navigator)));
    } finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => run(false)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/80 px-3 text-xs focus-visible:outline-2 focus-visible:outline-ring"><Share2 className="size-4" aria-hidden />{pick("링크 공유", "Share link")}</button>
      <button type="button" disabled={busy} onClick={() => run(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/80 px-3 text-xs focus-visible:outline-2 focus-visible:outline-ring"><Copy className="size-4" aria-hidden />{pick("링크 복사", "Copy link")}</button>
    </div>
    <p role="status" className="text-xs text-muted-foreground">{result === "copied" ? pick("링크를 복사했습니다.", "Link copied.") : result === "manual" ? pick("링크를 선택해 직접 복사하세요.", "Select the link and copy it manually.") : pick("링크는 이 종목의 최신 상태를 엽니다.", "This link opens the latest data for this symbol.")}</p>
    {result === "manual" && <input autoFocus readOnly value={url} aria-label={pick("수동 복사용 링크", "Link for manual copying")} onFocus={(event) => event.currentTarget.select()} className="min-h-11 w-full rounded-lg border border-border bg-background p-2 text-base" />}
  </div>;
}
