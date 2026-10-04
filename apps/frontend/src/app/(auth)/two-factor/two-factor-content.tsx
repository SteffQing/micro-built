"use client";

import { Icon, icons } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import { verifyTwoFactorTotp, sendTwoFactorOtp, verifyTwoFactorOtp, verifyTwoFactorBackup } from "@/lib/mutations/user/auth";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function TwoFactorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const [totpCode, setTotpCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const verifyTotp = useMutation(verifyTwoFactorTotp);
  const sendOtp = useMutation(sendTwoFactorOtp);
  const verifyOtp = useMutation(verifyTwoFactorOtp);
  const verifyBackup = useMutation(verifyTwoFactorBackup);

  const onSuccess = () => {
    toast.success("Verification successful");
    router.push(next);
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon icon={icons.shield} size={24} className="text-primary" />
          </div>
          <CardTitle className="text-xl">Two-factor authentication</CardTitle>
          <CardDescription>Verify your identity to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="totp">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="totp">Authenticator</TabsTrigger>
              <TabsTrigger value="otp">SMS/Email</TabsTrigger>
              <TabsTrigger value="backup">Backup code</TabsTrigger>
            </TabsList>
            <TabsContent value="totp" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">Enter the code from your authenticator app.</p>
              <Input
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                maxLength={6}
                autoComplete="one-time-code"
              />
              <Button
                className="w-full"
                onClick={() => verifyTotp.mutate({ code: totpCode }, { onSuccess })}
                disabled={totpCode.length < 6 || verifyTotp.isPending}
              >
                {verifyTotp.isPending && <Icon icon={icons.loaderCircle} size={16} className="animate-spin" />}
                Verify
              </Button>
            </TabsContent>
            <TabsContent value="otp" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                {otpSent ? "Enter the code sent to your device." : "Send a verification code to your device."}
              </p>
              {!otpSent ? (
                <Button
                  className="w-full"
                  onClick={() => sendOtp.mutate(undefined, { onSuccess: () => { setOtpSent(true); toast.success("Code sent"); } })}
                  disabled={sendOtp.isPending}
                >
                  {sendOtp.isPending && <Icon icon={icons.loaderCircle} size={16} className="animate-spin" />}
                  Send code
                </Button>
              ) : (
                <>
                  <Input
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                  <Button
                    className="w-full"
                    onClick={() => verifyOtp.mutate({ code: otpCode }, { onSuccess })}
                    disabled={otpCode.length < 6 || verifyOtp.isPending}
                  >
                    {verifyOtp.isPending && <Icon icon={icons.loaderCircle} size={16} className="animate-spin" />}
                    Verify
                  </Button>
                </>
              )}
            </TabsContent>
            <TabsContent value="backup" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">Enter one of your backup recovery codes.</p>
              <Input
                placeholder="Backup code"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={() => verifyBackup.mutate({ code: backupCode }, { onSuccess })}
                disabled={!backupCode || verifyBackup.isPending}
              >
                {verifyBackup.isPending && <Icon icon={icons.loaderCircle} size={16} className="animate-spin" />}
                Verify
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
