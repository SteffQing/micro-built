import { api, uploads } from "@/lib/axios";
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
    mutationFn: async ({ amount, proof }: { amount: number; proof: File }) => {
      const formData = new FormData();
      formData.append("amount", String(amount));
      formData.append("proof", proof);
      const response = await uploads.post<ApiRes<null>>(
        `${base}${id}/request-liquidation`,
        formData,
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
    mutationKey: [base, id, "report"],
    mutationFn: async (data: { from?: string; to?: string; format?: "pdf" | "xlsx"; email?: string; audience?: "admin" | "customer" } = {}) => {
      const response = await api.post<ApiRes<{ jobId: string }>>(
        `${base}${id}/report`,
        data,
      );
      return response.data;
    },
    onSuccess: () => toast.success("We'll notify you and email you when the report is ready"),
  });

export const loanTopup = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "loan-topup"],
    mutationFn: async (data: CustomerLoan) => {
      const response = await api.post<ApiRes<{ kind: "CASH" | "ASSET"; loanId: string; topupId: string | null; commodityLoanId: string | null }>>(
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

export const approveTenureChange = (requestId: string, borrowerId: string) =>
  mutationOptions({
    mutationKey: ["/admin/tenure-changes", requestId, "approve"],
    mutationFn: async () => {
      const response = await api.post<ApiRes<AdminTenureChangeDto>>(
        `/admin/tenure-changes/${requestId}/approve`,
      );
      return response.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [base, borrowerId] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/tenure-changes"] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/dashboard/"] }),
      ]).then(() => toast.success(data.message)),
  });

export const rejectTenureChange = (requestId: string, borrowerId: string) =>
  mutationOptions({
    mutationKey: ["/admin/tenure-changes", requestId, "reject"],
    mutationFn: async (data?: { note?: string }) => {
      const response = await api.post<ApiRes<AdminTenureChangeDto>>(
        `/admin/tenure-changes/${requestId}/reject`,
        data,
      );
      return response.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [base, borrowerId] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/tenure-changes"] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/dashboard/"] }),
      ]).then(() => toast.success(data.message)),
  });

export const requestCustomerTenureChange = (customerId: string) =>
  mutationOptions({
    mutationKey: [base, customerId, "tenure-changes"],
    mutationFn: async (data: { monthsDelta: number; apply?: boolean }) => {
      const response = await api.post<ApiRes<CustomerTenureChangeHistoryDto>>(
        `${base}${customerId}/tenure-changes`,
        data,
      );
      return response.data;
    },
    onSuccess: (data) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [base, customerId] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/tenure-changes"] }),
        queryClient.invalidateQueries({ queryKey: ["/admin/dashboard/"] }),
      ]).then(() => toast.success(data.message)),
  });
