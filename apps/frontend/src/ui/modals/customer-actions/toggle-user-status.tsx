"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { updateCustomerStatus } from "@/lib/mutations/admin/customer";
import { Icon, icons } from "@/components/icon";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { customerQuery } from "@/lib/queries/admin/customer";

interface Props {
  userId: string;
  reason: string | null;
  status: UserStatus;
}

function FlagCustomerModal({ userId }: Pick<Props, "userId">) {
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const { isPending, mutateAsync } = useMutation(updateCustomerStatus(userId));

  const handleOpen = (val: boolean) => {
    setFlagDialogOpen(val);
    if (!val) {
      setFlagReason("");
    }
  };

  const handleFlagAccount = async () => {
    await mutateAsync({
      status: "FLAGGED",
      reason: flagReason,
    });
    handleOpen(false);
  };

  return (
    <Dialog open={flagDialogOpen} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-warning border-warning/30 hover:bg-warning/10 hover:text-warning hover:border-warning/30"
        >
          <Icon icon={icons.alert} size={16} className="mr-2" />
          Flag Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Flag Account</DialogTitle>
          <DialogDescription>
            Flagging this account will restrict the user&#39;s access. Please
            provide a valid reason.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="grid gap-2">
            <Label htmlFor="flag-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="flag-reason"
              placeholder="E.g., Suspicious activity detected..."
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleFlagAccount}
            disabled={!flagReason.trim() || isPending}
            className="bg-warning hover:bg-warning/80 text-warning-foreground"
            loading={isPending}
          >
            Flag Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageFlaggedAccountModal({ userId, reason }: Props) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const { isPending, mutateAsync } = useMutation(updateCustomerStatus(userId));

  const [text, adminId] = reason?.split("|") || [];
  const { data } = useQuery({ ...customerQuery(adminId!), enabled: !!adminId });

  const handleConfirm = async () => {
    await mutateAsync({
      status: action,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Icon icon={icons.shield} size={16} />
          Manage Status
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Flagged Account</DialogTitle>
          <DialogDescription>
            Review the flag reason and decide the next step for this account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex gap-3 items-start">
            <Icon icon={icons.alertTriangle} size={20} className="text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-warning text-sm">
                Flagged Reason
              </p>
              <p className="text-sm text-warning leading-relaxed">
                {text || "No reason provided."}
                <span className="block text-xs text-warning">
                  {data && data.data?.name
                    ? `Flagged by ${data.data.name}`
                    : ""}
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Select Action</Label>
            <RadioGroup
              value={action}
              onValueChange={(v) => setAction(v as "ACTIVE" | "INACTIVE")}
              className="grid gap-3"
            >
              <Label
                htmlFor="opt-active"
                className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  action === "ACTIVE"
                    ? "border-success bg-success/10 ring-1 ring-success"
                    : "hover:bg-muted"
                }`}
              >
                <RadioGroupItem
                  value="ACTIVE"
                  id="opt-active"
                  className="mt-1 text-success border-success"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon icon={icons.checkCircle} size={16} className="text-success" />
                    <span className="font-semibold text-foreground">
                      Reactivate Account
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-normal">
                    Clear the flag and restore full access to the user.
                  </p>
                </div>
              </Label>

              <Label
                htmlFor="opt-inactive"
                className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  action === "INACTIVE"
                    ? "border-destructive bg-destructive/10 ring-1 ring-destructive"
                    : "hover:bg-muted"
                }`}
              >
                <RadioGroupItem
                  value="INACTIVE"
                  id="opt-inactive"
                  className="mt-1 text-destructive border-destructive"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon icon={icons.x} size={16} className="text-destructive" />
                    <span className="font-semibold text-foreground">
                      Deactivate Account
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-normal">
                    Permanently disable this account. User cannot log in.
                  </p>
                </div>
              </Label>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-[8px] p-2.5 text-primary-foreground font-medium text-sm flex-1 btn-gradient"
            loading={isPending}
          >
            {action === "ACTIVE"
              ? "Confirm Activation"
              : "Confirm Deactivation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewReasonModal({ reason, status }: Omit<Props, "userId">) {
  const [open, setOpen] = useState(false);

  const [text, adminId] = reason?.split("|") || [];
  const { data } = useQuery({ ...customerQuery(adminId!), enabled: !!adminId });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <Icon icon={icons.shield} size={16} className="mr-2" />
          View Status Reason
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Account Status</DialogTitle>
          <DialogDescription>
            Details regarding the current status of this account.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {reason ? (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icon icon={icons.alertTriangle} size={20} className="text-warning mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium text-warning">Flagged Reason</p>
                  <p className="text-sm text-warning">{text}</p>
                  <p className="text-xs text-warning">
                    {data && data.data?.name
                      ? `Flagged by ${data.data.name}`
                      : ""}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted rounded-lg p-4 border border-border">
              <p className="text-sm text-muted-foreground text-center">
                {status === "INACTIVE"
                  ? "Account is inactive. No specific flag reason recorded."
                  : "No limitation reason found."}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex-1 bg-muted rounded-[8px] p-2.5 text-muted-foreground font-medium text-sm"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ToggleUserStatus(
  props: Props & { adminRole: UserRole }
) {
  // 1. If Active -> Allow Flagging (All Admins)
  if (props.status === "ACTIVE") {
    return <FlagCustomerModal {...props} />;
  } else {
    // Super Admin can Resolve
    if (props.adminRole === "SUPER_ADMIN") {
      return <ManageFlaggedAccountModal {...props} />;
    }
    // Others, View Reason
    return <ViewReasonModal {...props} />;
  }
}
