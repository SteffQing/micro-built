"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export default function VerifyEmailForm() {
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const pendingUserId = localStorage.getItem("pendingUserId");
    if (!pendingUserId) {
      router.push("/signup");
      return;
    }
    setUserId(pendingUserId);
  }, [router]);

  const handleContinueToLogin = () => {
    localStorage.removeItem("pendingUserId");
    router.push("/login");
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 text-center">
      <div className="space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
          <Mail className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-normal">
            Check your email
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            We&apos;ve sent a verification email to your inbox. Please click the
            verification link to activate your account.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          User ID: <span className="font-mono text-primary">{userId}</span>
        </p>

        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or contact
          support.
        </p>

        <Button
          onClick={handleContinueToLogin}
          size="lg"
          className="w-full"
        >
          Continue to login
        </Button>
      </div>
    </div>
  );
}
