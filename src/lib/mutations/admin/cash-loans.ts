import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { toast } from "sonner";
import { base as customerBase } from "../../queries/admin/customer";

const base = "/admin/loans/cash/";

function invalidateQueries(loanId: string, userId?: string) {
  return Promise.all([
    ...(userId
      ? [
          queryClient.invalidateQueries({
            queryKey: [customerBase, userId, "loans"],
          }),
          queryClient.invalidateQueries({
            queryKey: [customerBase, userId, "summary"],
          }),
          queryClient.invalidateQueries({
            queryKey: [customerBase, userId, "active-loan"],
          }),
        ]
      : []),
    queryClient.invalidateQueries({ queryKey: [base] }),
    queryClient.invalidateQueries({ queryKey: [base, loanId] }),
  ]);
}

export const disburse = (id: string) =>
  mutationOptions({
    mutationKey: [base, "disburse", id],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<CustomerUserId>>(
        `${base}${id}/disburse`
      );
      return res.data;
    },
    onSuccess: (data) =>
      invalidateQueries(id, data.data?.userId).then(() =>
        toast.success(data.message)
      ),
  });

export const approve = (id: string) =>
  mutationOptions({
    mutationKey: [base, "approve", id],
    mutationFn: async (data: LoanTerms) => {
      const res = await api.patch<ApiRes<CustomerUserId>>(
        `${base}${id}/approve`,
        data
      );
      return res.data;
    },
    onSuccess: (data) =>
      invalidateQueries(id, data.data?.userId).then(() =>
        toast.success(data.message)
      ),
  });

export const reject = (id: string) =>
  mutationOptions({
    mutationKey: [base, "reject", id],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<CustomerUserId>>(
        `${base}${id}/reject`
      );
      return res.data;
    },
    onSuccess: (data) =>
      invalidateQueries(id, data.data?.userId).then(() =>
        toast.success(data.message)
      ),
  });
