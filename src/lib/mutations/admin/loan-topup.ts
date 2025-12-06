import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

const base = "/admin/loans/request/";

export const requestCashLoan = mutationOptions({
  mutationKey: [base, "cash"],
  mutationFn: async (data: CreateLoanDto & { userId: string }) => {
    const res = await api.post<ApiRes<{ id: string }>>(base + "cash", data);
    return res.data.message;
  },
  onSuccess: (data) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [base] }),
      queryClient.invalidateQueries({ queryKey: ["/admin/customers"] }),
    ]).then(() => toast.success(data)),
});

export const requestCommodityLoan = mutationOptions({
  mutationKey: [base, "commodity"],
  mutationFn: async (data: CreateCommodityLoanDto & { userId: string }) => {
    const res = await api.post<ApiRes<{ id: string }>>(
      base + "commodity",
      data
    );
    return res.data.message;
  },
  onSuccess: (data) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [base] }),
      queryClient.invalidateQueries({ queryKey: ["/admin/customers"] }),
    ]).then(() => toast.success(data)),
});
