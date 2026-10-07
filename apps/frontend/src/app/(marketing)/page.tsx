import type { Metadata } from "next";
import { ClosingCta, SiteFooter } from "@/ui/home/closing";
import { FaqSection } from "@/ui/home/faq";
import { EstimatorSection, ProductsSection, SecuritySection, StepsSection, TrackingSection } from "@/ui/home/features";
import HeroSection from "@/ui/home/hero";

export const metadata: Metadata = {
  title: { absolute: "MicroBuilt Prime · Salary-backed loans, repaid from your pay" },
  description:
    "Borrow cash or finance the things you need, and repay in fixed monthly amounts taken straight from your salary. See your monthly deduction before you apply.",
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
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
