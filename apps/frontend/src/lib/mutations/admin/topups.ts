import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base as topupsBase } from "@/lib/queries/admin/topups";
import { base as cashLoansBase, topupBase as cashTopupsBase } from "@/lib/queries/admin/cash-loans";
import { base as dashboardBase } from "@/lib/queries/admin/dashboard";

const base = "/admin/loans/topups";

export const approveTopup = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "approve"],
    // monthsDelta replaces the requested tenure change (0 drops it); absent keeps it.
    mutationFn: async (data?: { monthsDelta?: number; reprice?: boolean }) => {
      const res = await api.patch<ApiRes<AdminTopupDto>>(`${base}/${id}/approve`, data);
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [topupsBase] }),
        queryClient.invalidateQueries({ queryKey: [cashTopupsBase] }),
        queryClient.invalidateQueries({ queryKey: [cashLoansBase] }),
        queryClient.invalidateQueries({ queryKey: [dashboardBase] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/customer/"] }),
        // An asset top-up shows on its asset request too.
        queryClient.invalidateQueries({ queryKey: ["/admin/loans/commodity/"] }),
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
        queryClient.invalidateQueries({ queryKey: [cashTopupsBase] }),
        queryClient.invalidateQueries({ queryKey: [cashLoansBase] }),
        queryClient.invalidateQueries({ queryKey: [dashboardBase] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/customer/"] }),
        // An asset top-up shows on its asset request too.
        queryClient.invalidateQueries({ queryKey: ["/admin/loans/commodity/"] }),
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
        queryClient.invalidateQueries({ queryKey: [cashTopupsBase] }),
        queryClient.invalidateQueries({ queryKey: [cashLoansBase] }),
        queryClient.invalidateQueries({ queryKey: [dashboardBase] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/customer/"] }),
        // An asset top-up shows on its asset request too.
        queryClient.invalidateQueries({ queryKey: ["/admin/loans/commodity/"] }),
      ]).then(() => toast.success(data.message)),
  });
