import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
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

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#12151d" },
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
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
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
