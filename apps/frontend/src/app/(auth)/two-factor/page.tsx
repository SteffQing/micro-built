import { Suspense } from "react";
import TwoFactorContent from "./two-factor-content";

export default function TwoFactorPage() {
  return (
    <Suspense>
      <TwoFactorContent />
    </Suspense>
  );
}
