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
        data,
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
        data,
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
        data,
      );
      return response.data;
    },
    onSuccess: (data) =>
      queryClient
        .invalidateQueries({ queryKey: [base, id] })
        .then(() => toast.success(data.message)),
  });

export const generateCustomerReport = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "generate-report"],
    mutationFn: async (data: ReportRequestDto) => {
      const response = await api.post<ApiRes<null>>(
        `${base}${id}/generate-report`,
        data,
      );
      return response.data;
    },
    onSuccess: (data) => toast.success(data.message),
  });

export const loanTopup = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "loan-topup"],
    mutationFn: async (data: CustomerLoan) => {
      const response = await api.post<ApiRes<null>>(
        `${base}${id}/loan-topup`,
        data,
      );
      return response.data;
    },
    onSuccess: (data) =>
      queryClient
        .invalidateQueries({ queryKey: [base, id] })
        .then(() => toast.success(data.message)),
  });

export const previewTenureChange = (obligationId: string) =>
  mutationOptions({
    mutationKey: [
      "/admin/repayment-obligations",
      obligationId,
      "tenure-preview",
    ],
    mutationFn: async (termMonths: number) => {
      const response = await api.post<ApiRes<TenureChangePreviewDto>>(
        `/admin/repayment-obligations/${obligationId}/tenure-change-preview`,
        { termMonths },
      );
      return response.data;
    },
  });

export const requestTenureChange = (obligationId: string, borrowerId: string) =>
  mutationOptions({
    mutationKey: [
      "/admin/repayment-obligations",
      obligationId,
      "tenure-request",
    ],
    mutationFn: async (data: TenureChangeRequestDto) => {
      const response = await api.post<ApiRes<{ id: string }>>(
        `/admin/repayment-obligations/${obligationId}/tenure-change-requests`,
        data,
      );
      return response.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["/admin/repayment-obligations/borrower", borrowerId],
        }),
        queryClient.invalidateQueries({ queryKey: [base, borrowerId] }),
      ]).then(() => toast.success(data.message)),
  });
