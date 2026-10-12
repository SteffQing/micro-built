import type { Metadata } from "next";
import ResetPasswordForm from "@/ui/auth/forgot-password/reset-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordFlow() {
  return <ResetPasswordForm />;
}
