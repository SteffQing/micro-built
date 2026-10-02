import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

const base = "/admin/";

export const inviteAdmin = mutationOptions({
  mutationKey: [base, "invite-admin"],
  mutationFn: async (data: InviteAdminDto) => {
    const res = await api.post<ApiRes<null>>(`${base}invite-admin`, data);
    return res.data.message;
  },
  onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ["/admin"] }).then(() => toast.success(data)),
});

export const removeAdmin = mutationOptions({
  mutationKey: [base, "remove-admin"],
  mutationFn: async (data: RemoveAdminDto) => {
    const res = await api.patch<ApiRes<null>>(`${base}remove-admin`, data);
    return res.data.message;
  },
  onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ["/admin"] }).then(() => toast.success(data)),
});

export const updateRate = mutationOptions({
  mutationKey: [base, "rate"],
  mutationFn: async (data: UpdateRateDto) => {
    const res = await api.patch<ApiRes<RateSettings>>(`${base}rate`, data);
    return res.data;
  },
  onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ["config"] }).then(() => toast.success(data.message)),
});

export const addCommodity = mutationOptions({
  mutationKey: [base, "commodities"],
  mutationFn: async (data: CommodityDto) => {
    const res = await api.post<ApiRes<CommodityItem>>(`${base}commodities`, data);
    return res.data;
  },
  onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ["/admin/commodities"] }).then(() => toast.success(data.message)),
});

export const updateCommodity = (id: string) =>
  mutationOptions({
    mutationKey: [base, "commodities", id],
    mutationFn: async (data: UpdateCommodityDto) => {
      const res = await api.patch<ApiRes<CommodityItem>>(`${base}commodities/${id}`, data);
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/admin/commodities"] }),
        queryClient.invalidateQueries({ queryKey: ["config"] }),
      ]).then(() => toast.success(data.message)),
  });

export const toggleMaintenanceMode = mutationOptions({
  mutationKey: [base, "maintenance"],
  mutationFn: async () => {
    const res = await api.patch<ApiRes<null>>(`${base}maintenance`);
    return res.data.message;
  },
  onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ["config"] }).then(() => toast.success(data)),
});
