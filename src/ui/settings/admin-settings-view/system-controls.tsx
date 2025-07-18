import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function SystemControls({ mode }: { mode: boolean }) {
  function onMaintenanceModeChange(enabled: boolean) {
    console.log("Maintenance mode changed:", enabled);
  }
  return (
    <div className="p-3 lg:p-5">
      <div className="flex items-center justify-between border border-[#F0F0F0] bg-[#fafafa] p-4 pl-5 rounded-xl">
        <Label
          htmlFor="maintenance-mode"
          className="text-sm font-normal text-[#666666]"
        >
          Enable Maintenance Mode
        </Label>
        <Switch
          id="maintenance-mode"
          checked={mode}
          onCheckedChange={onMaintenanceModeChange}
        />
      </div>
    </div>
  );
}
