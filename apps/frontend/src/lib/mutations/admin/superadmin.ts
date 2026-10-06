import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminUsers, configData } from "@/lib/queries/admin/superadmin";
import { getAllCommodities, getConfig } from "@/lib/queries/config";

// The public config is cached under two keys: ["config"] (admin settings page) and
// ["/config/"] (loan request modal, which also owns ["/config/", "commodities"]).
const invalidateConfig = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: configData.queryKey }),
    queryClient.invalidateQueries({ queryKey: getConfig.queryKey }),
  ]);

const base = "/admin/";

export const inviteAdmin = mutationOptions({
  mutationKey: [base, "invite-admin"],
  mutationFn: async (data: InviteAdminDto) => {
    const res = await api.post<ApiRes<null>>(`${base}invite-admin`, data);
    return res.data.message;
  },
  onSuccess: (data) => queryClient.invalidateQueries({ queryKey: adminUsers.queryKey }).then(() => toast.success(data)),
});

export const removeAdmin = mutationOptions({
  mutationKey: [base, "remove-admin"],
  mutationFn: async (data: RemoveAdminDto) => {
    const res = await api.patch<ApiRes<null>>(`${base}remove-admin`, data);
    return res.data.message;
  },
  onSuccess: (data) => queryClient.invalidateQueries({ queryKey: adminUsers.queryKey }).then(() => toast.success(data)),
});

export const changeAdminRole = mutationOptions({
  mutationKey: [base, "admins", "role"],
  mutationFn: async ({ id, role }: { id: string; role: Exclude<UserRole, "CUSTOMER"> }) => {
    const res = await api.patch<ApiRes<null>>(`${base}admins/${id}/role`, { role });
    return res.data.message;
  },
  onSuccess: (data) => queryClient.invalidateQueries({ queryKey: adminUsers.queryKey }).then(() => toast.success(data)),
});

/** A locked-out customer or admin: their 2FA and passkeys go and they are signed out everywhere (super admins). */
export const resetSignIn = mutationOptions({
  mutationKey: [base, "users", "reset-sign-in"],
  mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
    const res = await api.post<ApiRes<null>>(`${base}users/${id}/reset-sign-in`, { reason });
    return res.data.message;
  },
  onSuccess: (data) => queryClient.invalidateQueries({ queryKey: adminUsers.queryKey }).then(() => toast.success(data)),
});

export const updateRate = mutationOptions({
  mutationKey: [base, "rate"],
  mutationFn: async (data: UpdateRateDto) => {
    const res = await api.patch<ApiRes<RateSettings>>(`${base}rate`, data);
    return res.data;
  },
  onSuccess: (data) => invalidateConfig().then(() => toast.success(data.message)),
});

export const addCommodity = mutationOptions({
  mutationKey: [base, "commodities"],
  mutationFn: async (data: CommodityDto) => {
    const res = await api.post<ApiRes<CommodityItem>>(`${base}commodities`, data);
    return res.data;
  },
  onSuccess: (data) => Promise.all([
      queryClient.invalidateQueries({ queryKey: getAllCommodities.queryKey }),
      invalidateConfig(),
    ]).then(() => toast.success(data.message)),
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
        queryClient.invalidateQueries({ queryKey: getAllCommodities.queryKey }),
        invalidateConfig(),
      ]).then(() => toast.success(data.message)),
  });

export const toggleMaintenanceMode = mutationOptions({
  mutationKey: [base, "maintenance"],
  mutationFn: async () => {
    const res = await api.patch<ApiRes<null>>(`${base}maintenance`);
    return res.data.message;
  },
  onSuccess: (data) => invalidateConfig().then(() => toast.success(data)),
});
