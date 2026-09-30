import {
  variationStateKey,
  type VariationBatch,
} from "@/lib/payroll/variations";
import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base as customerBase } from "@/lib/queries/admin/customer";
import { customersOverview } from "@/lib/queries/admin/customers";
import { customersOverview as dashboardCustomersOverview } from "@/lib/queries/admin/dashboard";

const base = "/admin/repayments/";

const invalidateCustomerMetrics = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: customersOverview.queryKey }),
    queryClient.invalidateQueries({
      queryKey: dashboardCustomersOverview.queryKey,
    }),
  ]);

const invalidateRepaymentViews = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: [base] }),
    invalidateCustomerMetrics(),
  ]);

const invalidateCustomerFinancials = (userId: string) =>
  Promise.all([
    invalidateCustomerMetrics(),
    queryClient.invalidateQueries({ queryKey: [customerBase, userId] }),
    queryClient.invalidateQueries({
      queryKey: ["/admin/repayment-obligations/borrower", userId],
    }),
  ]);

const waitForLiquidationCompletion = async (
  liquidationId: string,
  userId: string,
) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));

    try {
      const response = await api.get<ApiRes<CustomerLiquidationsRequestDto[]>>(
        `${customerBase}${userId}/liquidation-requests?limit=20`,
      );
      const request = response.data.data?.find(
        (item) => item.id === liquidationId,
      );

      if (request && request.status !== "REVIEWING") {
        await invalidateCustomerFinancials(userId);
        return;
      }
    } catch {
      // A transient status-check failure should not stop the next poll.
    }
  }

  await invalidateCustomerFinancials(userId);
};

export const uploadRepayment = mutationOptions({
  mutationKey: [base, "upload"],
  mutationFn: async (data: UploadRepaymentDto) => {
    const formData = new FormData();
    formData.append("file", data.file);
    const res = await api.post<ApiRes<AvatarDto>>(base + "upload", formData);
    return res.data;
  },
  onSuccess: (data) =>
    invalidateRepaymentViews().then(() => toast.success(data.message)),
});

export const validateRepayment = mutationOptions({
  mutationKey: [base, "validate"],
  mutationFn: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post<ApiRes<RepaymentValidationResult>>(
      base + "validate",
      formData,
    );
    return res.data;
  },
});

export const closeRepaymentPeriod = mutationOptions({
  mutationKey: [base, "close-period"],
  mutationFn: async (data: PeriodDto) => {
    const res = await api.post<ApiRes<null>>(base + "close-period", data);
    return res.data;
  },
  onSuccess: (data) =>
    invalidateRepaymentViews().then(() => toast.success(data.message)),
});

export const resolveRepayment = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "manual-resolution"],
    mutationFn: async (data: ManualRepaymentResolutionDto) => {
      const res = await api.patch<ApiRes<null>>(
        `${base}${id}/manual-resolution`,
        data,
      );
      return res.data;
    },
    onSuccess: (data) =>
      // Refresh the repayments list/detail so the resolved row reflects its new
      // status; the worker applies the loan/customer update asynchronously.
      invalidateRepaymentViews().then(() => toast.success(data.message)),
  });

export const requestVariationSchedule = mutationOptions({
  mutationKey: [base, "variation"],
  mutationFn: async (data: GenerateMonthlyLoanScheduleDto) => {
    const res = await api.post<ApiRes<VariationBatch>>(
      base + "variation",
      data,
    );
    return res.data;
  },
  onSuccess: (data) => {
    toast.success(data.message);
    return queryClient.invalidateQueries({ queryKey: variationStateKey });
  },
});

export const rejectLiquidation = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "reject-liquidation"],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<CustomerUserId>>(
        `${base}${id}/reject-liquidation`,
      );
      return res.data;
    },
    onSuccess: (data) =>
      queryClient
        .invalidateQueries({
          queryKey: [customerBase, data.data?.userId],
        })
        .then(() => toast.success(data.message)),
  });

export const acceptLiquidation = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "accept-liquidation"],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<CustomerUserId>>(
        `${base}${id}/accept-liquidation`,
      );
      return res.data;
    },
    onSuccess: (data) => {
      const userId = data.data?.userId;
      toast.success(data.message);
      if (!userId) return;

      void invalidateCustomerFinancials(userId);
      void waitForLiquidationCompletion(id, userId);
    },
  });
