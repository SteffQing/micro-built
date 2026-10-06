import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { configData } from "@/lib/queries/admin/superadmin";
import { getConfig } from "@/lib/queries/config";

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
      .then(() =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: configData.queryKey }),
          queryClient.invalidateQueries({ queryKey: getConfig.queryKey }),
        ]),
      )
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
      .then(() =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: configData.queryKey }),
          queryClient.invalidateQueries({ queryKey: getConfig.queryKey }),
        ]),
      )
      .then(() => toast.success("Commodity updated")),
});

/** SUPER_ADMIN: only a commodity no asset request uses (409 otherwise: hide it instead). */
export const deleteCommodity = mutationOptions({
  mutationKey: [base, "delete"],
  mutationFn: async (id: string) => {
    const res = await api.delete<ApiRes<CommodityItem>>(`${base}/${id}`);
    return res.data;
  },
  onSuccess: (data) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [base] }),
      queryClient.invalidateQueries({ queryKey: configData.queryKey }),
      queryClient.invalidateQueries({ queryKey: getConfig.queryKey }),
    ]).then(() => toast.success(data.message)),
  onError: (error) =>
    toast.error(
      (isAxiosError(error) && error.response?.data?.message) || "The commodity could not be deleted",
    ),
});
