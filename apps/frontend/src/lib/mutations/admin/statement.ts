import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

const base = "/admin/customer";

export const adminExportStatement = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "statement", "export"],
    mutationFn: async (data: { from?: string; to?: string; format?: "pdf" | "xlsx"; email?: string; audience?: "admin" | "customer"; protect?: boolean }) => {
      const res = await api.post<ApiRes<{ jobId: string }>>(`${base}/${id}/statement`, data);
      return res.data;
    },
    onSuccess: () => toast.success("We'll notify you and email you when the statement is ready"),
  });

export const adminExportReport = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "report", "export"],
    mutationFn: async (data: { from?: string; to?: string; format?: "pdf" | "xlsx"; email?: string; audience?: "admin" | "customer"; protect?: boolean }) => {
      const res = await api.post<ApiRes<{ jobId: string }>>(`${base}/${id}/report`, data);
      return res.data;
    },
    onSuccess: () => toast.success("We'll notify you and email you when the report is ready"),
  });
