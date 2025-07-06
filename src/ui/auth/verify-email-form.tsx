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
    <div className="w-full max-w-md mx-auto space-y-6 p-6 text-center">
      <div className="space-y-4">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Mail className="w-8 h-8 text-green-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Check Your Email</h1>
          <p className="text-muted-foreground">
            We&apos;ve sent a verification email to your inbox. Please click the
            verification link to activate your account.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          User ID: <span className="font-mono text-green-600">{userId}</span>
        </p>

        <p className="text-sm text-muted-foreground">
          Didn&apos;t receive the email? Check your spam folder or contact
          support.
        </p>

        <Button
          onClick={handleContinueToLogin}
          className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
        >
          Continue to Login
        </Button>
      </div>
    </div>
  );
}
