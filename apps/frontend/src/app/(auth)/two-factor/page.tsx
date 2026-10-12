import type { Metadata } from "next";
import { Suspense } from "react";
import TwoFactorContent from "./two-factor-content";

export const metadata: Metadata = { title: "Two-factor sign-in" };

export default function TwoFactorPage() {
  return (
    <Suspense>
      <TwoFactorContent />
    </Suspense>
  );
}
