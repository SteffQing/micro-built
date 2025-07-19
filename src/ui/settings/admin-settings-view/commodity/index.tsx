"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { AddCommodityDialog } from "./add-commodity-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/axios";

export default function CommodityList({
  commodities,
}: {
  commodities: string[];
}) {
  const queryClient = useQueryClient();

  const { mutate: removeMutation, isPending: removePending } = useMutation({
    mutationFn: async (commodity: string) => {
      const response = await api.delete("/admin/commodities", {
        data: {
          name: commodity,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-configs"] });
      toast.success("Commodity Removed Successfully");
    },
    onError: () => {
      toast.error("Failed to remove commodity");
    },
  });

  const onRemoveCommodity = (commodity: string) => {
    removeMutation(commodity);
  };

  return (
    <div className="p-3 lg:p-5">
      <h4 className="mb-3 mt-5 text-sm text-muted-foreground font-normal">
        Commodity list
      </h4>
      <div className="flex flex-wrap gap-2 border rounded-xl p-3">
        {commodities.map((commodity) => (
          <div
            key={commodity}
            className="flex items-center gap-2 border p-3 rounded-lg"
          >
            <p className="font-normal text-sm">{commodity}</p>
            <Button
              variant="ghost"
              disabled={removePending}
              size="sm"
              className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onRemoveCommodity(commodity)}
            >
              <X className="h-4 w-4 " />
            </Button>
          </div>
        ))}
        <AddCommodityDialog />
      </div>
    </div>
  );
}
