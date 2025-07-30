import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

const base = "/user/";

export const updateAvatar = mutationOptions({
  mutationKey: [base, "avatar"],
  mutationFn: async (data: File) => {
    const formData = new FormData();
    formData.append("file", data);
    const res = await api.post<ApiRes<AvatarDto>>(base + "avatar", formData);
    return res.data;
  },
  onSuccess: (data) => queryClient.invalidateQueries({ queryKey: [base] }).then(() => toast.success(data.message)),
});

export const updatePassword = mutationOptions({
  mutationKey: [base, "password"],
  mutationFn: async (data: UpdatePasswordBodyDto) => {
    const res = await api.patch<ApiRes<null>>(base + "password", data);
    return res.data.message;
  },
  onSuccess: (data) => toast.success(data),
});
