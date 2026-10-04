import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { toast } from "sonner";
import { base as customerBase } from "../../queries/admin/customer";

const base = "/admin/loans/cash/";
const topupBase = "/admin/loans/topups/";

function invalidateQueries(loanId: string, userId?: string) {
  return Promise.all([
    ...(userId
      ? [
          queryClient.invalidateQueries({
            queryKey: [customerBase, userId],
          }),
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
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "/admin/loans/commodity/",
    }),
    queryClient.invalidateQueries({ queryKey: [topupBase] }),
  ]);
}

export const disburse = (id: string) =>
  mutationOptions({
    mutationKey: [base, "disburse", id],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<CashLoan>>(
        `${base}${id}/disburse`,
      );
      return res.data;
    },
    onSuccess: (data) =>
      invalidateQueries(id, data.data?.borrower?.id).then(() =>
        toast.success("Success"),
      ),
  });

export const approve = (id: string) =>
  mutationOptions({
    mutationKey: [base, "approve", id],
    mutationFn: async (data: LoanTerms) => {
      const res = await api.patch<ApiRes<CashLoan>>(
        `${base}${id}/approve`,
        data,
      );
      return res.data;
    },
    onSuccess: (data) =>
      invalidateQueries(id, data.data?.borrower?.id).then(() =>
        toast.success(data.message),
      ),
  });

export const reject = (id: string) =>
  mutationOptions({
    mutationKey: [base, "reject", id],
    mutationFn: async (data?: RejectLoanDto) => {
      const res = await api.patch<ApiRes<CashLoan>>(
        `${base}${id}/reject`,
        data,
      );
      return res.data;
    },
    onSuccess: (data) =>
      invalidateQueries(id, data.data?.borrower?.id).then(() =>
        toast.success(data.message),
      ),
  });

// Topup approval/rejection/disbursement

export const approveTopup = (id: string) =>
  mutationOptions({
    mutationKey: [topupBase, "approve", id],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<Topup>>(
        `${topupBase}${id}/approve`,
      );
      return res.data;
    },
    onSuccess: (data) => {
      const loanId = data.data?.loanId;
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [topupBase] }),
        queryClient.invalidateQueries({ queryKey: [base] }),
        ...(loanId ? [queryClient.invalidateQueries({ queryKey: [base, loanId] })] : []),
      ]).then(() => toast.success(data.message));
    },
  });

export const rejectTopup = (id: string) =>
  mutationOptions({
    mutationKey: [topupBase, "reject", id],
    mutationFn: async (data?: RejectLoanDto) => {
      const res = await api.patch<ApiRes<Topup>>(
        `${topupBase}${id}/reject`,
        data,
      );
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [topupBase] }),
        queryClient.invalidateQueries({ queryKey: [base] }),
      ]).then(() => toast.success(data.message)),
  });

export const disburseTopup = (id: string) =>
  mutationOptions({
    mutationKey: [topupBase, "disburse", id],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<Topup>>(
        `${topupBase}${id}/disburse`,
      );
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [topupBase] }),
        queryClient.invalidateQueries({ queryKey: [base] }),
      ]).then(() => toast.success(data.message)),
  });
