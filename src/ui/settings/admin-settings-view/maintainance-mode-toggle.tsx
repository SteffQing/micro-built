import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ToggleResponse {
  message: string;
  data: null;
}

export  function MaintenanceMoodControls() {
  // const queryClient = useQueryClient();
  // const queryKey = ["config-maintenance-mode"];

  const {
    data,
    isLoading: isModeLoading,
    refetch,
  } = useQuery({
    queryKey: ["config-matainance-mood"],
    queryFn: async () => {
      const response = await api.get<{ data: boolean }>(
        "/config/maintenance-mode"
      );
      return response.data;
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const response = await api.patch<ToggleResponse>("/admin/maintenance");
      return response.data;
    },
    onSuccess: () => {
      refetch();
      toast.success("Maintenance mode enabled");
    },
    onError: () => {
      refetch();
      toast.error("Failed to enable maintenance mode");
    },
  });

  const currentMode = data?.data ?? false;
  const isDisabled = isModeLoading || isPending;

  function onMaintenanceModeChange(enabled: boolean) {
    console.log("Maintenance mode changing to:", enabled);
    mutate();
  }
  return (
    <div className="p-3 lg:p-5">
      <div className="flex items-center justify-between border bg-muted/30 p-4 pl-5 rounded-xl">
        <Label
          htmlFor="maintenance-mode"
          className="text-sm font-normal text-muted-foreground"
        >
          Enable Maintenance Mode
        </Label>
        {isModeLoading ? (
          <Skeleton className="w-7 h-3" />
        ) : (
          <Switch
            id="maintenance-mode"
            checked={currentMode}
            onCheckedChange={onMaintenanceModeChange}
            disabled={isDisabled}
            className={`cursor-pointer ${isPending ? "opacity-60" : ""}`}
          />
        )}
      </div>
    </div>
  );
}
