import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SystemControlsProps {
  maintenanceMode: boolean;
  onMaintenanceModeChange: (enabled: boolean) => void;
}

export default function SystemControls({
  maintenanceMode,
  onMaintenanceModeChange,
}: SystemControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">System Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="maintenance-mode" className="text-sm font-medium">
            Enable Maintenance Mode
          </Label>
          <Switch
            id="maintenance-mode"
            checked={maintenanceMode}
            onCheckedChange={onMaintenanceModeChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
