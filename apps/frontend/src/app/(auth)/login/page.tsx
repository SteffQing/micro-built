import { Suspense } from "react";
import LoginForm from "@/ui/auth/login-form";

export default function Login() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
