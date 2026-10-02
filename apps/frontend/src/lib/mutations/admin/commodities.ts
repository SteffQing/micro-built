import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

const base = "/admin/commodities";

export const createCommodity = mutationOptions({
  mutationKey: [base, "create"],
  mutationFn: async (data: { name: string }) => {
    const res = await api.post<ApiRes<CommodityItem>>(base, data);
    return res.data;
  },
  onSuccess: () =>
    queryClient
      .invalidateQueries({ queryKey: [base] })
      .then(() => queryClient.invalidateQueries({ queryKey: ["config"] }))
      .then(() => toast.success("Commodity added")),
});

export const toggleCommodity = mutationOptions({
  mutationKey: [base, "toggle"],
  mutationFn: async (data: { id: string; active: boolean }) => {
    const res = await api.patch<ApiRes<CommodityItem>>(`${base}/${data.id}`, {
      active: data.active,
    });
    return res.data;
  },
  onSuccess: () =>
    queryClient
      .invalidateQueries({ queryKey: [base] })
      .then(() => queryClient.invalidateQueries({ queryKey: ["config"] }))
      .then(() => toast.success("Commodity updated")),
});
