import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base as tenureBase } from "@/lib/queries/admin/tenure-changes";

const base = "/admin/tenure-changes";

export const approveTenureChangeAdmin = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "approve"],
    mutationFn: async () => {
      const res = await api.post<ApiRes<AdminTenureChangeDto>>(`${base}/${id}/approve`);
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [tenureBase] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/customer/"] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/dashboard/"] }),
      ]).then(() => toast.success(data.message)),
  });

export const rejectTenureChangeAdmin = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "reject"],
    mutationFn: async (data?: { note?: string }) => {
      const res = await api.post<ApiRes<AdminTenureChangeDto>>(`${base}/${id}/reject`, data);
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [tenureBase] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/customer/"] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/dashboard/"] }),
      ]).then(() => toast.success(data.message)),
  });
