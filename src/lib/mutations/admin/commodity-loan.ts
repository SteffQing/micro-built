import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";

const base = "/admin/loans/commodity/";

export const approve = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "approve"],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}/approve`);
      return res.data.message;
    },
  });

export const reject = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "reject"],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<null>>(`${base}${id}/reject`);
      return res.data.message;
    },
  });
