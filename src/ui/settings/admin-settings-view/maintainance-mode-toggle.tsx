import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { toggleMaintenanceMode } from "@/lib/mutations/admin/superadmin";

export function MaintenanceMoodControls({ mode, loading }: { mode: boolean; loading: boolean }) {
  const { mutateAsync, isPending } = useMutation(toggleMaintenanceMode);

  async function onMaintenanceModeChange(enabled: boolean) {
    console.log("Maintenance mode changing to:", enabled);
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
          <Switch
            id="maintenance-mode"
            checked={mode}
            onCheckedChange={onMaintenanceModeChange}
            disabled={loading}
            className={`cursor-pointer ${isPending ? "opacity-60" : ""}`}
          />
        )}
      </div>
    </div>
  );
}
