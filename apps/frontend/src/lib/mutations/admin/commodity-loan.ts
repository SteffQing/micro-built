import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { toast } from "sonner";
import { base as customerBase } from "../../queries/admin/customer";

const base = "/admin/loans/commodity/";

export const approve = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "approve"],
    mutationFn: async (data: AcceptCommodityLoan) => {
      const res = await api.patch<ApiRes<CustomerUserId>>(
        `${base}${id}/approve`,
        data,
      );
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [base] }),
        queryClient.invalidateQueries({ queryKey: [base, id] }),
        ...(data.data?.userId
          ? [
              queryClient.invalidateQueries({
                queryKey: [customerBase, data.data.userId],
              }),
            ]
          : []),
      ]).then(() => toast.success("Successfully approved commodity loan")),
  });

export const reject = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "reject"],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<CustomerUserId>>(
        `${base}${id}/reject`,
      );
      return res.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [base] }),
        queryClient.invalidateQueries({ queryKey: [base, id] }),
        ...(data.data?.userId
          ? [
              queryClient.invalidateQueries({
                queryKey: [customerBase, data.data.userId],
              }),
            ]
          : []),
      ]).then(() => toast.success(data.message)),
  });
