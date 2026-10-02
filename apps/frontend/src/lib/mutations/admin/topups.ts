import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base as topupsBase } from "@/lib/queries/admin/topups";

const base = "/admin/loans/topups";

export const approveTopup = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "approve"],
    mutationFn: async (data?: { monthsDelta?: number }) => {
      const res = await api.patch<ApiRes<AdminTopupDto>>(`${base}/${id}/approve`, data);
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [topupsBase] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/customer/"] }),
      ]).then(() => toast.success(data.message)),
  });

export const rejectTopup = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "reject"],
    mutationFn: async (data?: { note?: string }) => {
      const res = await api.patch<ApiRes<AdminTopupDto>>(`${base}/${id}/reject`, data);
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [topupsBase] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/customer/"] }),
      ]).then(() => toast.success(data.message)),
  });

export const disburseTopup = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "disburse"],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<AdminTopupDto>>(`${base}/${id}/disburse`);
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [topupsBase] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/customer/"] }),
      ]).then(() => toast.success(data.message)),
  });
