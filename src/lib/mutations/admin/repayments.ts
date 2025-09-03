import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base as customerBase } from "@/lib/queries/admin/customer";

const base = "/admin/repayments/";

export const uploadRepayment = mutationOptions({
  mutationKey: [base, "upload"],
  mutationFn: async (data: UploadRepaymentDto) => {
    const formData = new FormData();
    formData.append("file", data.file);
    formData.append("period", data.period);
    const res = await api.post<ApiRes<AvatarDto>>(base + "upload", formData);
    return res.data;
  },
  onSuccess: (data) => toast.success(data.message),
});

export const rejectLiquidation = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "reject-liquidation"],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<null>>(
        `${base}${id}/reject-liquidation`
      );
      return res.data;
    },
    onSuccess: (data) =>
      queryClient
        .invalidateQueries({
          queryKey: [customerBase, "liquidation-requests"],
        })
        .then(() => toast.success(data.message)),
  });

export const acceptLiquidation = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "accept-liquidation"],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<null>>(
        `${base}${id}/accept-liquidation`
      );
      return res.data;
    },
    onSuccess: (data) =>
      queryClient
        .invalidateQueries({
          queryKey: [customerBase, "liquidation-requests"],
        })
        .then(() => toast.success(data.message)),
  });
