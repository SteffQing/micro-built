import type { Metadata } from "next";
import SignupForm from "@/ui/auth/sign-up/sign-up-form";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Sign up for MicroBuilt Prime, add your work and payroll details, and request a salary-backed loan repaid from your pay.",
  alternates: { canonical: "/sign-up" },
  robots: { index: true, follow: true },
};

export default function SignUpFlow() {
  return <SignupForm />;
}
