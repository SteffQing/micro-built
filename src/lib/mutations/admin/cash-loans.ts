import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";

const base = "/admin/loans/cash/";

export const disburse = (id: string) =>
  mutationOptions({
    mutationKey: [base, "disburse", id],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}/disburse`);
      return res.data.message;
    },
  });

export const setTerms = (id: string) =>
  mutationOptions({
    mutationKey: [base, "set-terms", id],
    mutationFn: async (data: LoanTerms) => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}/set-terms`, data);
      return res.data.message;
    },
  });

export const reject = (id: string) =>
  mutationOptions({
    mutationKey: [base, "reject", id],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}/reject`);
      return res.data.message;
    },
  });
