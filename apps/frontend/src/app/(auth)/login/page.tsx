import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/ui/auth/login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to MicroBuilt Prime to check your loan balance, see your next deduction and request a top-up.",
  alternates: { canonical: "/login" },
  robots: { index: true, follow: true },
};

export default function Login() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
