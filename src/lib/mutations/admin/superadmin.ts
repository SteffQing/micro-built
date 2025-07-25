import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";

const base = "/admin";

export const inviteAdmin = mutationOptions({
  mutationKey: [base, "invite"],
  mutationFn: async (data: InviteAdminDto) => {
    const res = await api.post<ApiRes<null>>(`${base}/invite`, data);
    return res.data.message;
  },
});

export const updateRate = mutationOptions({
  mutationKey: [base, "rate"],
  mutationFn: async (data: UpdateRateDto) => {
    const res = await api.patch<ApiRes<null>>(`${base}/rate`, data);
    return res.data.message;
  },
});

export const addComodity = mutationOptions({
  mutationKey: [base, "commodities"],
  mutationFn: async (data: CommodityDto) => {
    const res = await api.patch<ApiRes<null>>(`${base}/commodities`, data);
    return res.data.message;
  },
});

export const deleteCommodity = mutationOptions({
  mutationKey: [base, "commodities"],
  mutationFn: async (data: CommodityDto) => {
    const res = await api.delete<ApiRes<null>>(`${base}/commodities`, { data });
    return res.data.message;
  },
});

export const toggleMaintenanceMode = mutationOptions({
  mutationKey: [base, "maintenance"],
  mutationFn: async () => {
    const res = await api.patch<ApiRes<null>>(`${base}/maintenance`);
    return res.data.message;
  },
});
