import { api } from "@/lib/axios";
import { mutationOptions } from "@tanstack/react-query";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { toast } from "sonner";

const base = "/admin/customer/";
export const updateCustomerStatus = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "status"],
    mutationFn: async (data: CustomerStatusDto) => {
      const response = await api.patch<ApiRes<null>>(
        `${base}${id}/status`,
        data
      );
      return response.data;
    },
    onSuccess: (data) =>
      queryClient
        .invalidateQueries({ queryKey: [base] })
        .then(() => toast.success(data.message)),
  });

export const messageCustomer = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "message"],
    mutationFn: async (data: InAppMessageCustomer) => {
      const response = await api.post<ApiRes<null>>(
        `${base}${id}/message`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => toast.success(data.message),
  });

export const liquidationRequest = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "request-liquidation"],
    mutationFn: async (data: LiquidationRequestDto) => {
      const response = await api.post<ApiRes<null>>(
        `${base}${id}/request-liquidation`,
        data
      );
      return response.data;
    },
    onSuccess: (data) =>
      queryClient
        .invalidateQueries({
          queryKey: [base, "liquidation-requests"],
        })
        .then(() => toast.success(data.message)),
  });


  export const generateCustomerReport = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "generate-report"],
    mutationFn: async (data: ReportRequestDto) => {
      const response = await api.post<ApiRes<null>>(
        `${base}${id}/generate-report`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => toast.success(data.message),
  });
