import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { toggleMaintenanceMode } from "@/lib/mutations/admin/superadmin";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ReactNode, useState } from "react";
import { Separator } from "@/components/ui/separator";

interface Props {
  mode: boolean;
  loading: boolean;
}

export function MaintenanceMoodControls({ mode, loading }: Props) {
  const { mutateAsync, isPending } = useMutation(toggleMaintenanceMode);

  async function onMaintenanceModeChange(enabled: boolean) {
    await mutateAsync();
  }
  return (
    <div className="p-3 lg:p-5">
      <div className="flex items-center justify-between border bg-muted/30 p-4 pl-5 rounded-xl">
        <Label htmlFor="maintenance-mode" className="text-sm font-normal text-muted-foreground">
          {mode ? "Disable" : "Enable"} Maintenance Mode
        </Label>
        {loading ? (
          <Skeleton className="w-7 h-3" />
        ) : (
          // <MaintenanceModeDialog mode={mode} loading={loading}>
          <Switch
            id="maintenance-mode"
            checked={mode}
            disabled={loading}
            className={`cursor-pointer ${isPending ? "opacity-60" : ""}`}
            onCheckedChange={onMaintenanceModeChange}
          />
          // </MaintenanceModeDialog>
        )}
      </div>
    </div>
  );
}

interface DialogProps extends Props {
  children: ReactNode;
}

function MaintenanceModeDialog({ mode, loading, children }: DialogProps) {
  const [open, setOpen] = useState(false);
  const { mutateAsync, isPending } = useMutation(toggleMaintenanceMode);

  async function onMaintenanceModeChange() {
    await mutateAsync();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
        {/* <Switch
          id="maintenance-mode"
          checked={mode}
          disabled={loading}
          className={`cursor-pointer ${isPending ? "opacity-60" : ""}`}
          // onCheckedChange={onMaintenanceModeChange}
        /> */}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode ? "Disable" : "Enable"} Maintenance Mode</DialogTitle>
        </DialogHeader>
        <Separator className="bg-[#F0F0F0]" />
        <div className="grid gap-4 p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to {mode ? "disable" : "enable"} maintenance mode?
          </p>
          <Separator className="bg-[#F0F0F0]" />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="flex-1 bg-[#FAFAFA] rounded-[8px] p-2.5 text-[#999999] font-medium text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={onMaintenanceModeChange}
            loading={isPending}
            className="rounded-[8px] p-2.5 text-white font-medium text-sm flex-1 btn-gradient"
          >
            Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
