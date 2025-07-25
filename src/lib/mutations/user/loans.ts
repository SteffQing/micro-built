import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";

const base = "/user/loan/";

export const requestCashLoan = mutationOptions({
  mutationKey: [base],
  mutationFn: async (data: CreateLoanDto) => {
    const res = await api.post<ApiRes<{ id: string }>>(base, data);
    return res.data.message;
  },
});

export const updateCashLoan = (id: string) =>
  mutationOptions({
    mutationKey: [base, id],
    mutationFn: async (data: Partial<CreateLoanDto>) => {
      const res = await api.put<ApiRes<null>>(`${base}${id}`, data);
      return res.data.message;
    },
  });

export const updateCashLoanStatus = (id: string) =>
  mutationOptions({
    mutationKey: [base, id],
    mutationFn: async (data: UpdateLoanStatusDto) => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}`, data);
      return res.data.message;
    },
  });

export const deleteCashLoan = (id: string) =>
  mutationOptions({
    mutationKey: [base, id],
    mutationFn: async () => {
      const res = await api.delete<ApiRes<null>>(`${base}${id}`);
      return res.data.message;
    },
  });

export const requestCommodityLoan = mutationOptions({
  mutationKey: [base],
  mutationFn: async (data: CreateCommodityLoanDto) => {
    const res = await api.post<ApiRes<{ id: string }>>(base + "commodity", data);
    return res.data.message;
  },
});
