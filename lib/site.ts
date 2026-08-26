/**
 * Canonical origin of the deployed board.
 *
 * Hardcoded rather than derived from the request: canonical URLs, the sitemap
 * and every share card have to name one address, and a preview deployment
 * reading its own hostname would publish `*-git-*.vercel.app` links into
 * search results and social embeds.
 */
export const SITE_URL = "https://sigma-dashboard-five.vercel.app";

/** Bare host, for printing on the share card where a full URL would not fit. */
export const SITE_HOST = "sigma-dashboard-five.vercel.app";

export const SITE_NAME = "1SIGMA";

export const SITE_TAGLINE = "Market Range Monitor";
