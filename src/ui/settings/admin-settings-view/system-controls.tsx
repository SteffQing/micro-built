import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function SystemControls({ mode }: { mode: boolean }) {
  function onMaintenanceModeChange(enabled: boolean) {
    console.log("Maintenance mode changed:", enabled);
  }
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
            checked={mode}
            onCheckedChange={onMaintenanceModeChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
