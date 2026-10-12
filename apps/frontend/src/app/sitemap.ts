import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// The public pages. Everything else sits behind sign-in.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.7 },
    { url: `${SITE_URL}/support`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/sign-up`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
