import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

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
