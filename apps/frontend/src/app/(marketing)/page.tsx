import type { Metadata } from "next";
import { openGraph, SITE_NAME, SITE_URL } from "@/lib/seo";
import { SUPPORT_EMAIL } from "@/lib/support";
import { ClosingCta, SiteFooter } from "@/ui/home/closing";
import { FaqSection, questions } from "@/ui/home/faq";
import { EstimatorSection, ProductsSection, SecuritySection, StepsSection, TrackingSection } from "@/ui/home/features";
import HeroSection from "@/ui/home/hero";

const title = "MicroBuilt Prime · Salary-backed loans, repaid from your pay";
const description =
  "Borrow cash or finance the things you need, and repay in fixed monthly amounts taken straight from your salary. See your monthly deduction before you apply.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/" },
  openGraph: openGraph({ title, description, path: "/" }),
};

// Structured data for search engines: who runs the site, and the FAQ section's questions.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FinancialService",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      email: SUPPORT_EMAIL,
      description,
      areaServed: { "@type": "Country", name: "Nigeria" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: questions.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        // Our own static data; escape "<" so no string can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="flex-1">
        <HeroSection />
        <ProductsSection />
        <EstimatorSection />
        <StepsSection />
        <TrackingSection />
        <SecuritySection />
        <FaqSection />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
