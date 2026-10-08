import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportPage } from "@/ui/support/support-page";

export const metadata: Metadata = {
  title: { absolute: "Help & support · MicroBuilt Prime" },
  description:
    "Ask MicroBuilt Prime's assistant about salary-backed loans, repayments and your account, or reach the team.",
};

export default function Page() {
  return (
    <Suspense>
      <SupportPage />
    </Suspense>
  );
}
