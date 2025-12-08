import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { toast } from "sonner";

const base = "/admin/customers/";

export const uploadCustomerForm = mutationOptions({
  mutationKey: [base],
  mutationFn: async (data: OnboardCustomer) => {
    const response = await api.post<ApiRes<CustomerUserId>>(base, data);
    return response.data;
  },
  onSuccess: (data) => {
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [base] }),
      queryClient.invalidateQueries({ queryKey: [base, "overview"] }),
    ]).then(() => toast.success(data.message));
  },
});

export const uploadExistingCustomers = mutationOptions({
  mutationKey: [base, "upload-existing"],
  mutationFn: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post<ApiRes<null>>(
      base + "upload-existing",
      formData
    );
    return res.data;
  },
  onSuccess: (data) => toast.success(data.message),
});
