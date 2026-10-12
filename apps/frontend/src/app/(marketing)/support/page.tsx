import type { Metadata } from "next";
import { Suspense } from "react";
import { openGraph } from "@/lib/seo";
import { SupportPage } from "@/ui/support/support-page";

const title = "Help & support · MicroBuilt Prime";
const description =
  "Ask MicroBuilt Prime's assistant about salary-backed loans, repayments and your account, or reach the team.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/support" },
  openGraph: openGraph({ title, description, path: "/support" }),
};

export default function Page() {
  return (
    <Suspense>
      <SupportPage />
    </Suspense>
  );
}
