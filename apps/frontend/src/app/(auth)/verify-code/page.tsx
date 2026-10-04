import { Suspense } from "react";
import VerifyEmailForm from "@/ui/auth/verify-email-form";

export default function VerifyCodePage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
