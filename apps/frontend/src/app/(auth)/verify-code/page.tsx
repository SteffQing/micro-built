import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyEmailForm from "@/ui/auth/verify-email-form";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyCodePage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
