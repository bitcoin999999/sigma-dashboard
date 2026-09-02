import type { MetadataRoute } from "next";

import { loadBoard } from "@/lib/board";
import { SCREENERS } from "@/lib/screeners";
import { SITE_URL } from "@/lib/site";

/** The snapshot decides which symbols exist, so this cannot be static. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { snapshot, all } = await loadBoard();

  // Every page on the site is rendered from one snapshot, so they all change
  // together the moment the publisher overwrites the blob.
  const lastModified = new Date(snapshot.generatedAt);

  return [
    { url: SITE_URL, lastModified, changeFrequency: "daily", priority: 1 },
    {
      url: `${SITE_URL}/my-sigma`,
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    // The two pages that are not views of the snapshot: one explains the
    // board, the other prices leveraged funds off its own live feed.
    {
      url: `${SITE_URL}/calculator`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guide`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    ...SCREENERS.map((screener) => ({
      url: `${SITE_URL}/screener/${screener.slug}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...all.map((stock) => ({
      url: `${SITE_URL}/symbol/${stock.symbol}`,
      lastModified,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
