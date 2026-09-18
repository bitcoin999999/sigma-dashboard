"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, Search, Star, Menu, X } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { SCREENERS } from "@/lib/screeners";

export function MobileNav({ sessionDate }: { sessionDate: string }) {
  const pathname = usePathname();
  const { pick, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const item = "flex min-h-14 min-w-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px] focus-visible:outline-2 focus-visible:outline-ring";
  return <nav aria-label={pick("모바일 주요 메뉴", "Mobile navigation")} className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-3 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
    <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
      <Link prefetch={false} href="/" className={item} aria-current={pathname === "/" ? "page" : undefined}><Home className="size-5" aria-hidden />{pick("홈", "Home")}</Link>
      {pathname === "/" ? <a href="#watchlist" className={item}><Search className="size-5" aria-hidden />{pick("탐색", "Explore")}</a> : <Link prefetch={false} href="/#watchlist" className={item}><Search className="size-5" aria-hidden />{pick("탐색", "Explore")}</Link>}
      <Link prefetch={false} href="/my-sigma" className={item} aria-current={pathname === "/my-sigma" ? "page" : undefined}><Star className="size-5" aria-hidden />My Sigma</Link>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className={item}><Menu className="size-5" aria-hidden />{pick("더보기", "More")}</DialogTrigger>
        <DialogContent showCloseButton={false} className="max-h-[80dvh] overflow-y-auto">
          <div className="flex items-center justify-between"><DialogTitle>{pick("더보기", "More")}</DialogTitle><DialogClose aria-label={pick("메뉴 닫기", "Close menu")} className="flex size-11 items-center justify-center rounded-lg"><X className="size-5" aria-hidden /></DialogClose></div>
          <DialogDescription>{pick("시장 탐색과 도구", "Market views and tools")}</DialogDescription>
          <div className="grid gap-1">{[
            {href:"/#market", ko:"시장 요약·이번 주 일정", en:"Market summary & calendar"},
            {href:"/#lastweek", ko:"주간 밴드 리캡", en:"Weekly recap"},
            {href:"/#sectors", ko:"섹터 ETF", en:"Sector ETFs"},
            {href:"/calculator", ko:"계산기", en:"Calculator"},
            {href:"/guide", ko:"가이드·데이터 설명", en:"Guide & methodology"},
            {href:`/daily/${sessionDate}`, ko:"오늘의 카드", en:"Daily card"},
          ].map((link) => <Link key={link.href} prefetch={false} href={link.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-2 hover:bg-accent">{pick(link.ko, link.en)}</Link>)}</div>
          <div className="flex flex-wrap gap-2">{SCREENERS.map((screener) => <Link prefetch={false} key={screener.slug} href={`/screener/${screener.slug}`} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg border border-border px-2 text-xs">{screener.copy[locale].title}</Link>)}</div>
          <div className="flex items-center gap-3 border-t border-border pt-3"><LocaleToggle /><ThemeToggle /></div>
        </DialogContent>
      </Dialog>
    </div>
  </nav>;
}
