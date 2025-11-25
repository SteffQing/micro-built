"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { updateCustomerStatus } from "@/lib/mutations/admin/customer";
import { AlertTriangle, Flag, ShieldCheck } from "lucide-react";
import { DialogDescription } from "@radix-ui/react-dialog";
import { Label } from "@/components/ui/label";
import { CustomerPage } from "@/components/svg/customers";

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
          variant="ghost"
          size="sm"
          className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 px-2"
        >
          <Flag className="w-4 h-4 mr-1" />
          <span className="text-xs font-medium">Flag Account</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Flag Account</DialogTitle>
          <DialogDescription>
            Please provide a reason for flagging this account. This information
            will be recorded for audit purposes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="flag-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="flag-reason"
              placeholder="Enter the reason for flagging this account..."
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleFlagAccount}
            disabled={!flagReason.trim() || isPending}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            loading={isPending}
          >
            Flag Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivateCustomerModal({ userId, ...props }: Props) {
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const { isPending, mutateAsync } = useMutation(updateCustomerStatus(userId));

  const handleActivateAccount = async () => {
    await mutateAsync({
      status: "ACTIVE",
    });
    setActivateDialogOpen(false);
  };

  return (
    <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-green-600 hover:text-green-700 hover:bg-green-50 px-2"
          disabled={isPending}
        >
          <ShieldCheck className="w-4 h-4 mr-1" />
          <span className="text-xs font-medium">Activate Account</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Activate Account</DialogTitle>
          <DialogDescription>
            Please review the information below before activating this account.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ViewAccountLimitationReason {...props} />
          <p className="text-sm text-muted-foreground mt-4">
            By activating this account, you confirm that you have reviewed the
            above and verified that the account is safe to reactivate.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setActivateDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleActivateAccount}
            disabled={isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
            loading={isPending}
          >
            Confirm Activation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateCustomerAccount({ userId }: Pick<Props, "userId">) {
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const { isPending, mutateAsync } = useMutation(updateCustomerStatus(userId));

  const handleDeactivateAccount = async () => {
    await mutateAsync({
      status: "INACTIVE",
    });
    setDeactivateDialogOpen(false);
  };

  return (
    <Button
      className="bg-transparent border-0 outline-0 hover:bg-transparent shadow-none px-0"
      size="sm"
      variant="ghost"
      onClick={handleDeactivateAccount}
      loading={isPending}
    >
      <div className="flex gap-1 items-center">
        <CustomerPage.deactivate_account pathProps={{ fill: "#13E741" }} />
        <p className="text-xs text-[#FF4141] font-normal text-[#13E741]">
          Deactivate Account
        </p>
      </div>
    </Button>
  );
}

function ViewAccountLimitationReasonComponent(props: Omit<Props, "userId">) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-green-600 hover:text-green-700 hover:bg-green-50 px-2"
        >
          <ShieldCheck className="w-4 h-4 mr-1" />
          <span className="text-xs font-medium">View Flag Reason</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>View reason for Account limitation</DialogTitle>
          <DialogDescription>
            You can ping Super Admins to help reactivate this account!
          </DialogDescription>
        </DialogHeader>
        <ViewAccountLimitationReason {...props} />
      </DialogContent>
    </Dialog>
  );
}

function ViewAccountLimitationReason({
  reason,
  status,
}: Omit<Props, "userId">) {
  return (
    <>
      {reason ? (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-medium text-orange-800">
                Reason for flagging:
              </p>
              <p className="text-sm text-orange-700">{reason}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-muted rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            {status === "INACTIVE"
              ? "This account was deactivated. No flagging reason was recorded."
              : "No flagging reason was recorded for this account."}
          </p>
        </div>
      )}
    </>
  );
}

export default function ToggleUserStatus(
  props: Props & { adminRole: UserRole }
) {
  if (props.status === "FLAGGED" && props.adminRole === "SUPER_ADMIN") {
    return (
      <div className="flex gap-1 items-center">
        <ActivateCustomerModal {...props} />
        <DeactivateCustomerAccount {...props} />
      </div>
    );
  }
  if (props.status === "ACTIVE") {
    return <FlagCustomerModal {...props} />;
  } else {
    return <ViewAccountLimitationReasonComponent {...props} />;
  }
}
