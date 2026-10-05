import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base } from "@/lib/queries/admin/change-requests";

function refresh(message: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [base] }),
    queryClient.invalidateQueries({ queryKey: ["/admin/customer/"] }),
    queryClient.invalidateQueries({ queryKey: ["/admin/audit"] }),
  ]).then(() => toast.success(message));
}

export const approveChangeRequest = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "approve"],
    mutationFn: async () => {
      const res = await api.post<ApiRes<ChangeRequestDto>>(`${base}/${id}/approve`);
      return res.data;
    },
    onSuccess: (data) => refresh(data.message),
  });

export const rejectChangeRequest = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "reject"],
    mutationFn: async (data?: { note?: string }) => {
      const res = await api.post<ApiRes<ChangeRequestDto>>(`${base}/${id}/reject`, data);
      return res.data;
    },
    onSuccess: (data) => refresh(data.message),
  });
