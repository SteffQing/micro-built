"use client";

import { dialogBodyClass } from "@/components/ui/dialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";

import {
  authClient,
  changePassword,
  twoFactor,
  passkey,
  emailOtp,
  phoneNumber,
  listSessions,
  revokeOtherSessions,
} from "@/lib/auth-client";
import { useUserProvider } from "@/store/auth";
import { getUser } from "@/lib/queries/user";
import { isPlaceholderEmail, visibleEmail } from "@microbuilt/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Icon, icons } from "@/components/icon";
import { toast } from "sonner";

// ─── Change Password ────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: true,
      });
      if (res.error) throw new Error(res.error.message ?? "Failed to change password");
      return res.data;
    },
    onSuccess: () => {
      toast.success("Password changed successfully. Other sessions have been revoked.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from current password");
      return;
    }
    mutateAsync({ currentPassword, newPassword });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon icon={icons.lock} size={18} />
          Change Password
        </CardTitle>
        <CardDescription>
          Update your password. Other active sessions will be revoked.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                disabled={isPending}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <Icon icon={icons.eyeOff} size={16} /> : <Icon icon={icons.view} size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">New Password</label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={isPending}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <Icon icon={icons.eyeOff} size={16} /> : <Icon icon={icons.view} size={16} />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              disabled={isPending}
              required
            />
          </div>
          <Button type="submit" className="w-full" loading={isPending}>
            Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Two-Factor Authentication ──────────────────────────────────────────────

export function TwoFactorSection() {
  const { userRole, twoFactorEnabled } = useUserProvider();
  const queryClient = useQueryClient();
  const refreshUser = () => queryClient.invalidateQueries({ queryKey: getUser.queryKey });
  const isAdmin = userRole && userRole !== "CUSTOMER" && userRole !== "MARKETER";

  // Enable 2FA flow
  const [enablePassword, setEnablePassword] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState("");
  const [showEnableDialog, setShowEnableDialog] = useState(false);

  // Disable 2FA flow
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisableDialog, setShowDisableDialog] = useState(false);

  // Regenerate backup codes
  const [regenPassword, setRegenPassword] = useState("");
  const [regenBackupCodes, setRegenBackupCodes] = useState<string[]>([]);
  const [showRegenDialog, setShowRegenDialog] = useState(false);

  const enableMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await twoFactor.enable({ password, method: "totp" } as Parameters<typeof twoFactor.enable>[0]);
      if (res.error) throw new Error(res.error.message ?? "2FA enable failed");
      return res.data;
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await twoFactor.verifyTotp({ code });
      if (res.error) throw new Error(res.error.message ?? "2FA verification failed");
      return res.data;
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await twoFactor.disable({ password });
      if (res.error) throw new Error(res.error.message ?? "2FA disable failed");
      return res.data;
    },
  });

  const regenMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await twoFactor.generateBackupCodes({ password });
      if (res.error) throw new Error(res.error.message ?? "Failed to generate backup codes");
      return res.data;
    },
  });

  const handleEnable = () => {
    if (!enablePassword) {
      toast.error("Please enter your password");
      return;
    }
    enableMutation.mutate(enablePassword, {
      onSuccess: (data) => {
        if (data && "totpURI" in data && data.totpURI) {
          setTotpURI(data.totpURI);
          setBackupCodes((data as { backupCodes: string[] }).backupCodes ?? []);
          setEnablePassword("");
        }
      },
    });
  };

  const handleVerify = () => {
    if (!verifyCode) {
      toast.error("Please enter the verification code");
      return;
    }
    verifyMutation.mutate(verifyCode, {
      onSuccess: () => {
        toast.success("Two-factor authentication enabled successfully!");
        refreshUser();
        setShowEnableDialog(false);
        setTotpURI(null);
        setBackupCodes([]);
        setVerifyCode("");
      },
    });
  };

  const handleDisable = () => {
    if (!disablePassword) {
      toast.error("Please enter your password");
      return;
    }
    disableMutation.mutate(disablePassword, {
      onSuccess: () => {
        toast.success("Two-factor authentication disabled");
        setShowDisableDialog(false);
        setDisablePassword("");
      },
    });
  };

  const handleRegenerate = () => {
    if (!regenPassword) {
      toast.error("Please enter your password");
      return;
    }
    regenMutation.mutate(regenPassword, {
      onSuccess: (data) => {
        setRegenBackupCodes(data?.backupCodes ?? []);
        setRegenPassword("");
      },
    });
  };

  const copyBackupCodes = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join("\n"));
    toast.success("Backup codes copied to clipboard");
  };

  const downloadBackupCodes = (codes: string[]) => {
    const blob = new Blob([codes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "microbuilt-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup codes downloaded");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon icon={icons.shield} size={18} />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <Badge variant={twoFactorEnabled ? "default" : "secondary"}>
              {twoFactorEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>

        {!twoFactorEnabled && (
          <div className="space-y-3">
            {isAdmin && (
              <Alert>
                <Icon icon={icons.shieldAlert} size={16} />
                <AlertTitle>2FA Required</AlertTitle>
                <AlertDescription>
                  Admin accounts must have two-factor authentication enabled.
                </AlertDescription>
              </Alert>
            )}
            <Button onClick={() => setShowEnableDialog(true)}>
              Enable 2FA
            </Button>
          </div>
        )}

        {twoFactorEnabled && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRegenDialog(true)}
              >
                Regenerate Backup Codes
              </Button>
              {!isAdmin && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDisableDialog(true)}
                >
                  Disable 2FA
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Enable 2FA Dialog */}
        <Dialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                {!totpURI
                  ? "Enter your password to begin setting up 2FA."
                  : "Scan the QR code with your authenticator app, then enter the verification code."}
              </DialogDescription>
            </DialogHeader>

            {!totpURI ? (
              <div className={dialogBodyClass}>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={enablePassword}
                  onChange={(e) => setEnablePassword(e.target.value)}
                  disabled={enableMutation.isPending}
                />
                <DialogFooter>
                  <Button
                    onClick={handleEnable}
                    loading={enableMutation.isPending}
                  >
                    Continue
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className={dialogBodyClass}>
                <div className="flex justify-center p-4 bg-white rounded-md">
                  <QRCodeSVG value={totpURI} size={200} />
                </div>

                {backupCodes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                      Save these backup codes — they won&apos;t be shown again:
                    </p>
                    <div className="grid grid-cols-2 gap-1 p-3 bg-muted rounded-md font-mono text-sm">
                      {backupCodes.map((code, i) => (
                        <div key={i}>{code}</div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyBackupCodes(backupCodes)}
                      >
                        <Icon icon={icons.copy} size={14} />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadBackupCodes(backupCodes)}
                      >
                        <Icon icon={icons.download} size={14} />
                        Download
                      </Button>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Verification Code</label>
                  <Input
                    placeholder="Enter 6-digit code"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    disabled={verifyMutation.isPending}
                    maxLength={6}
                  />
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleVerify}
                    loading={verifyMutation.isPending}
                  >
                    Verify &amp; Enable
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Disable 2FA Dialog */}
        <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Enter your password to disable 2FA. This will make your account less secure.
              </DialogDescription>
            </DialogHeader>
            <div className={dialogBodyClass}>
              <Input
                type="password"
                placeholder="Enter your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                disabled={disableMutation.isPending}
              />
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={handleDisable}
                  loading={disableMutation.isPending}
                >
                  Disable 2FA
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Regenerate Backup Codes Dialog */}
        <Dialog open={showRegenDialog} onOpenChange={setShowRegenDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Regenerate Backup Codes</DialogTitle>
              <DialogDescription>
                {!regenBackupCodes.length
                  ? "Enter your password to generate new backup codes. Old codes will be invalidated."
                  : "Save these new backup codes — they won't be shown again."}
              </DialogDescription>
            </DialogHeader>
            {!regenBackupCodes.length ? (
              <div className={dialogBodyClass}>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={regenPassword}
                  onChange={(e) => setRegenPassword(e.target.value)}
                  disabled={regenMutation.isPending}
                />
                <DialogFooter>
                  <Button
                    onClick={handleRegenerate}
                    loading={regenMutation.isPending}
                  >
                    Generate
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-1 p-3 bg-muted rounded-md font-mono text-sm">
                  {regenBackupCodes.map((code, i) => (
                    <div key={i}>{code}</div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyBackupCodes(regenBackupCodes)}
                  >
                    <Icon icon={icons.copy} size={14} />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadBackupCodes(regenBackupCodes)}
                  >
                    <Icon icon={icons.download} size={14} />
                    Download
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRegenDialog(false);
                      setRegenBackupCodes([]);
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── Passkeys ───────────────────────────────────────────────────────────────

interface PasskeyItem {
  id: string;
  name?: string;
  publicKey: string;
  userId: string;
  credentialID: string;
  counter: number;
  deviceType?: string;
  backedUp?: boolean;
  transports?: string;
  createdAt: Date;
  aaguid?: string;
}

function PasskeysSection() {
  const { userRole } = useUserProvider();
  const isAdmin = userRole && userRole !== "CUSTOMER" && userRole !== "MARKETER";

  const queryClient = useQueryClient();

  const { data: passkeys, isLoading: passkeysLoading } = useQuery({
    queryKey: ["passkeys"],
    queryFn: async () => {
      const res = await authClient.passkey.listUserPasskeys();
      if (res.error) throw new Error(res.error.message ?? "Failed to list passkeys");
      return (res.data ?? []) as PasskeyItem[];
    },
  });

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await passkey.addPasskey();
      if (res.error) throw new Error(res.error.message ?? "Failed to add passkey");
      return res.data;
    },
    onSuccess: () => {
      toast.success("Passkey added successfully");
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await authClient.passkey.updatePasskey({ id, name });
      if (res.error) throw new Error(res.error.message ?? "Failed to rename passkey");
      return res.data;
    },
    onSuccess: () => {
      toast.success("Passkey renamed");
      setRenameId(null);
      setRenameValue("");
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authClient.passkey.deletePasskey({ id });
      if (res.error) throw new Error(res.error.message ?? "Failed to delete passkey");
      return res.data;
    },
    onSuccess: () => {
      toast.success("Passkey deleted");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["passkeys"] });
    },
  });

  // Passkeys are for customers only
  if (isAdmin) return null;

  const handleRename = () => {
    if (!renameId || !renameValue.trim()) return;
    renameMutation.mutate({ id: renameId, name: renameValue.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon icon={icons.lock} size={18} />
          Passkeys
        </CardTitle>
        <CardDescription>
          Manage passkeys for passwordless sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className={dialogBodyClass}>
        <Button onClick={() => addMutation.mutate()} loading={addMutation.isPending}>
          <Icon icon={icons.plus} size={16} />
          Add Passkey
        </Button>

        {passkeysLoading && (
          <p className="text-sm text-muted-foreground">Loading passkeys…</p>
        )}

        {passkeys && passkeys.length > 0 && (
          <div className="space-y-2">
            {passkeys.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center justify-between p-3 rounded-md border bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium">{pk.name || "Unnamed passkey"}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {pk.createdAt ? new Date(pk.createdAt).toLocaleDateString() : "N/A"}
                    {pk.deviceType && ` · ${pk.deviceType === "singleDevice" ? "Device-bound" : "Synced"}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRenameId(pk.id);
                      setRenameValue(pk.name ?? "");
                    }}
                  >
                    <Icon icon={icons.edit} size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(pk.id)}
                  >
                    <Icon icon={icons.delete} size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!passkeysLoading && passkeys && passkeys.length === 0 && (
          <p className="text-sm text-muted-foreground">No passkeys registered.</p>
        )}

        {/* Rename Dialog */}
        <Dialog open={!!renameId} onOpenChange={(open) => !open && setRenameId(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Rename Passkey</DialogTitle>
              <DialogDescription>Give this passkey a memorable name.</DialogDescription>
            </DialogHeader>
            <div className={dialogBodyClass}>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="e.g. iPhone, YubiKey"
                disabled={renameMutation.isPending}
              />
              <DialogFooter>
                <Button onClick={handleRename} loading={renameMutation.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Passkey</DialogTitle>
              <DialogDescription>
                Are you sure? You won&apos;t be able to use this passkey to sign in.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                loading={deleteMutation.isPending}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── Email Change ───────────────────────────────────────────────────────────

function EmailChangeSection() {
  const { user } = useUserProvider();
  const currentEmail = user?.email ?? null;
  const hasRealEmail = currentEmail ? !isPlaceholderEmail(currentEmail) : false;

  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");

  const requestMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await emailOtp.requestEmailChange({ newEmail: email });
      if (res.error) throw new Error(res.error.message ?? "Failed to request email change");
      return res.data;
    },
    onSuccess: () => {
      setStep("verify");
      toast.success("Verification code sent to your new email");
    },
  });

  const changeMutation = useMutation({
    mutationFn: async ({ newEmail, otp }: { newEmail: string; otp: string }) => {
      const res = await emailOtp.changeEmail({ newEmail, otp });
      if (res.error) throw new Error(res.error.message ?? "Failed to change email");
      return res.data;
    },
    onSuccess: () => {
      toast.success("Email changed successfully");
      setNewEmail("");
      setOtp("");
      setStep("input");
    },
  });

  const handleRequest = () => {
    if (!newEmail.trim()) {
      toast.error("Please enter a new email address");
      return;
    }
    requestMutation.mutate(newEmail.trim());
  };

  const handleChange = () => {
    if (!otp.trim()) {
      toast.error("Please enter the verification code");
      return;
    }
    changeMutation.mutate({ newEmail: newEmail.trim(), otp: otp.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon icon={icons.mail} size={18} />
          Email Address
        </CardTitle>
        <CardDescription>
          {hasRealEmail
            ? "Change the email address associated with your account."
            : "Add an email address to your account."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasRealEmail && (
          <p className="text-sm text-muted-foreground mb-4">
            Current: <span className="font-medium text-foreground">{visibleEmail(currentEmail)}</span>
          </p>
        )}

        {step === "input" ? (
          <div className="space-y-3 max-w-md">
            <Input
              type="email"
              placeholder="Enter new email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={requestMutation.isPending}
            />
            <Button onClick={handleRequest} loading={requestMutation.isPending}>
              Send Verification Code
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-md">
            <p className="text-sm text-muted-foreground">
              A verification code was sent to <span className="font-medium text-foreground">{newEmail}</span>.
            </p>
            <Input
              placeholder="Enter verification code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              disabled={changeMutation.isPending}
            />
            <div className="flex gap-2">
              <Button onClick={handleChange} loading={changeMutation.isPending}>
                Verify &amp; Change Email
              </Button>
              <Button variant="outline" onClick={() => setStep("input")}>
                Back
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Phone Change ───────────────────────────────────────────────────────────

function PhoneChangeSection() {
  const { user } = useUserProvider();

  const [newPhone, setNewPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"input" | "verify">("input");

  const sendMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await phoneNumber.sendOtp({ phoneNumber: phone });
      if (res.error) throw new Error(res.error.message ?? "Failed to send OTP");
      return res.data;
    },
    onSuccess: () => {
      setStep("verify");
      toast.success("Verification code sent to your new phone number");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ phoneNumber: phone, code }: { phoneNumber: string; code: string }) => {
      const res = await phoneNumber.verify({
        phoneNumber: phone,
        code,
        updatePhoneNumber: true,
      } as Parameters<typeof phoneNumber.verify>[0]);
      if (res.error) throw new Error(res.error.message ?? "Verification failed");
      return res.data;
    },
    onSuccess: () => {
      toast.success("Phone number updated successfully");
      setNewPhone("");
      setOtp("");
      setStep("input");
    },
  });

  const handleSend = () => {
    if (!newPhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }
    sendMutation.mutate(newPhone.trim());
  };

  const handleVerify = () => {
    if (!otp.trim()) {
      toast.error("Please enter the verification code");
      return;
    }
    verifyMutation.mutate({ phoneNumber: newPhone.trim(), code: otp.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon icon={icons.phone} size={18} />
          Phone Number
        </CardTitle>
        <CardDescription>
          Update the phone number linked to your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {user?.phoneNumber && (
          <p className="text-sm text-muted-foreground mb-4">
            Current: <span className="font-medium text-foreground">{user.phoneNumber}</span>
          </p>
        )}

        {step === "input" ? (
          <div className="space-y-3 max-w-md">
            <Input
              type="tel"
              placeholder="Enter new phone number"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              disabled={sendMutation.isPending}
            />
            <Button onClick={handleSend} loading={sendMutation.isPending}>
              Send Verification Code
            </Button>
          </div>
        ) : (
          <div className="space-y-3 max-w-md">
            <p className="text-sm text-muted-foreground">
              A verification code was sent to <span className="font-medium text-foreground">{newPhone}</span>.
            </p>
            <Input
              placeholder="Enter verification code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              disabled={verifyMutation.isPending}
            />
            <div className="flex gap-2">
              <Button onClick={handleVerify} loading={verifyMutation.isPending}>
                Verify &amp; Update
              </Button>
              <Button variant="outline" onClick={() => setStep("input")}>
                Back
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Active Sessions ────────────────────────────────────────────────────────

interface SessionItem {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function SessionsSection() {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const res = await listSessions();
      if (res.error) throw new Error(res.error.message ?? "Failed to list sessions");
      return (res.data ?? []) as SessionItem[];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const res = await revokeOtherSessions();
      if (res.error) throw new Error(res.error.message ?? "Failed to revoke sessions");
      return res.data;
    },
    onSuccess: () => {
      toast.success("All other sessions have been revoked");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });

  const formatUserAgent = (ua: string | null | undefined) => {
    if (!ua) return "Unknown device";
    if (ua.includes("Chrome")) return "Chrome";
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    if (ua.includes("Edge")) return "Edge";
    return ua.slice(0, 50);
  };

  const currentSessionToken = session?.session?.token;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon icon={icons.userGroup} size={18} />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Devices currently signed in to your account.
            </CardDescription>
          </div>
          {(sessions?.length ?? 0) > 1 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => revokeMutation.mutate()}
              loading={revokeMutation.isPending}
            >
              Revoke All Other Sessions
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessionsLoading && (
          <p className="text-sm text-muted-foreground">Loading sessions…</p>
        )}

        {!sessionsLoading && sessions && sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        )}

        {sessions?.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between p-3 rounded-md border bg-muted/50"
          >
            <div>
              <p className="text-sm font-medium">
                {formatUserAgent(s.userAgent)}
                {s.token === currentSessionToken && (
                  <Badge variant="default" className="ml-2 text-xs">This device</Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                IP: {s.ipAddress ?? "Unknown"}
                {s.createdAt && ` · Created ${new Date(s.createdAt).toLocaleDateString()}`}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : "N/A"}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main Security Page ─────────────────────────────────────────────────────

export function SecuritySettings() {
  const { userRole } = useUserProvider();
  const isAdmin = !!userRole && userRole !== "CUSTOMER" && userRole !== "MARKETER";
  return (
    <div className="max-w-4xl space-y-6 p-6">
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-muted-foreground">Security Settings</h2>
        <p className="text-muted-foreground">Manage your account security, authentication methods, and sessions.</p>
      </div>

      <ChangePasswordSection />

      <TwoFactorSection />

      {/* Admins sign in with password + 2FA only, so passkeys are hidden for them. */}
      {!isAdmin && <PasskeysSection />}

      <EmailChangeSection />

      <PhoneChangeSection />

      <SessionsSection />
    </div>
  );
}
