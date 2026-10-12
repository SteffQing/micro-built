import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Cloudflare prepends its content-signal comments to this file at the edge.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/monitoring"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
