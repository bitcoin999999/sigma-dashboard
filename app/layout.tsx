import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getRequestLocale } from "@/lib/i18n-server";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_METADATA: Metadata = {
  // Without this, every relative canonical and generated OG image URL below
  // resolves against localhost at build time and ships that way.
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} · ${SITE_TAGLINE}`,
  description:
    "A statistical view of the market — where every tracked symbol sits inside its own expected range.",
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  // Named for what a reader would actually type. Left deliberately short: a
  // long keyword list is ignored by every engine that matters and reads as
  // stuffing to the ones that do not.
  keywords: [
    "implied volatility",
    "expected move",
    "weekly options range",
    "1 sigma",
    "standard deviation",
    "market range monitor",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/",
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description:
      "A statistical view of the market — where every tracked symbol sits inside its own expected range.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description:
      "A statistical view of the market — where every tracked symbol sits inside its own expected range.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  if (locale === "en") return BASE_METADATA;

  const description = "각 종목이 자신의 주간 expected range 안에서 어디에 있는지 보여주는 통계적 시장 뷰.";
  return {
    ...BASE_METADATA,
    description,
    openGraph: { ...BASE_METADATA.openGraph, description },
    twitter: { ...BASE_METADATA.twitter, description },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#12151d" },
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getRequestLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      // `scroll-smooth` is for the in-page section links. Without this,
      // navigating between routes animates the scroll to the top as well.
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <LocaleProvider initialLocale={locale}>
            <TooltipProvider>{children}</TooltipProvider>
          </LocaleProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
