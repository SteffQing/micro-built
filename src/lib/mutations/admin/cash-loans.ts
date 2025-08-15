import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { toast } from "sonner";
import { base as customerBase } from "../../queries/admin/customer";

const base = "/admin/loans/cash/";

function invalidateQueries(id: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [customerBase, id, "loans"] }),
    queryClient.invalidateQueries({ queryKey: [customerBase, id, "summary"] }),
    queryClient.invalidateQueries({ queryKey: [base] }),
    queryClient.invalidateQueries({ queryKey: [base, id] }),
  ]);
}

export const disburse = (id: string) =>
  mutationOptions({
    mutationKey: [base, "disburse", id],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}/disburse`);
      return res.data.message;
    },
    onSuccess: (data) => invalidateQueries(id).then(() => toast.success(data)),
  });

export const setTerms = (id: string) =>
  mutationOptions({
    mutationKey: [base, "set-terms", id],
    mutationFn: async (data: LoanTerms) => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}/set-terms`, data);
      return res.data.message;
    },
    onSuccess: (data) => invalidateQueries(id).then(() => toast.success(data)),
  });

export const reject = (id: string) =>
  mutationOptions({
    mutationKey: [base, "reject", id],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}/reject`);
      return res.data.message;
    },
    onSuccess: (data) => invalidateQueries(id).then(() => toast.success(data)),
  });

export const approve = (id: string) =>
  mutationOptions({
    mutationKey: [base, "approve", id],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}/approve`);
      return res.data.message;
    },
    onSuccess: (data) => invalidateQueries(id).then(() => toast.success(data)),
  });
