import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

const base = "/user/statement";

export const exportStatement = mutationOptions({
  mutationKey: [base, "export"],
  mutationFn: async (data: { from?: string; to?: string; format?: "pdf" | "xlsx"; email?: string }) => {
    const res = await api.post<ApiRes<{ jobId: string }>>(base, data);
    return res.data;
  },
  onSuccess: () => toast.success("We'll notify you and email you when your statement is ready"),
});

export const exportReport = mutationOptions({
  mutationKey: ["/user/report", "export"],
  mutationFn: async (data: { from?: string; to?: string; format?: "pdf" | "xlsx"; email?: string }) => {
    const res = await api.post<ApiRes<{ jobId: string }>>("/user/report", data);
    return res.data;
  },
  onSuccess: () => toast.success("We'll notify you and email you when your report is ready"),
});
