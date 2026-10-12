import type { Metadata } from "next";

/** The public site. Canonical URLs, the sitemap and social previews all point here. */
export const SITE_URL = "https://microbuiltprime.com";
export const SITE_NAME = "MicroBuilt Prime";
export const SITE_DESCRIPTION =
  "Salary-backed loans for salary earners in Nigeria. Borrow cash or finance the things you need, and repay in fixed monthly amounts taken straight from your pay.";

/**
 * A page's Open Graph tags. Next replaces a parent's `openGraph` instead of merging it, so every page that sets its own
 * title passes it through here to keep the site name, locale, type and the preview card (app/opengraph-image.tsx),
 * which a page's own `openGraph` would otherwise drop.
 */
export function openGraph(page: { title: string; description: string; path?: string }): Metadata["openGraph"] {
  return {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_NG",
    title: page.title,
    description: page.description,
    url: page.path,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE_NAME}: salary-backed loans, repaid from your pay` }],
  };
}
