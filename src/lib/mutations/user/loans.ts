import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

const base = "/user/loan/";

export const requestCashLoan = mutationOptions({
  mutationKey: [base],
  mutationFn: async (data: CreateLoanDto) => {
    const res = await api.post<ApiRes<{ id: string }>>(base, data);
    return res.data.message;
  },
  onSuccess: (data) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [base] }),
      queryClient.invalidateQueries({ queryKey: [base, "overview"] }),
      queryClient.invalidateQueries({ queryKey: ["/user/", "recent-activity"] }),
      queryClient.invalidateQueries({ queryKey: ["/user/", "overview"] }),
    ]).then(() => toast.success(data)),
});

export const updateCashLoan = (id: string) =>
  mutationOptions({
    mutationKey: [base, id],
    mutationFn: async (data: Partial<CreateLoanDto>) => {
      const res = await api.put<ApiRes<null>>(`${base}${id}`, data);
      return res.data.message;
    },
    onSuccess: (data) => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [base] }),
        queryClient.invalidateQueries({ queryKey: [base, id] }),
      ]).then(() => toast.success(data));
    },
  });

export const updateCashLoanStatus = (id: string) =>
  mutationOptions({
    mutationKey: [base, id],
    mutationFn: async (data: UpdateLoanStatusDto) => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}`, data);
      return res.data.message;
    },
    onSuccess: (data) => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [base] }),
        queryClient.invalidateQueries({ queryKey: [base, id] }),
      ]).then(() => toast.success(data));
    },
  });

export const deleteCashLoan = (id: string) =>
  mutationOptions({
    mutationKey: [base, id],
    mutationFn: async () => {
      const res = await api.delete<ApiRes<null>>(`${base}${id}`);
      return res.data.message;
    },
    onSuccess: (data) => {
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [base] }),
        queryClient.invalidateQueries({ queryKey: [base, id] }),
      ]).then(() => toast.success(data));
    },
  });

export const requestCommodityLoan = mutationOptions({
  mutationKey: [base],
  mutationFn: async (data: CreateCommodityLoanDto) => {
    const res = await api.post<ApiRes<{ id: string }>>(base + "commodity", data);
    return res.data.message;
  },
  onSuccess: (data) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [base] }),
      queryClient.invalidateQueries({ queryKey: [base, "overview"] }),
      queryClient.invalidateQueries({ queryKey: ["/user/", "recent-activity"] }),
      queryClient.invalidateQueries({ queryKey: ["/user/", "overview"] }),
    ]).then(() => toast.success(data)),
});
