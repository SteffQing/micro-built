import {
  generateVariation,
  revertVariation,
  submitVariation,
  variationBase,
  variationKey,
} from "@/lib/payroll/variations";
import { api, uploads } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base as customerBase } from "@/lib/queries/admin/customer";
import { customersOverview } from "@/lib/queries/admin/customers";
import { customersOverview as dashboardCustomersOverview, base as dashboardBase } from "@/lib/queries/admin/dashboard";

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
    // Uploading / closing a period / resolving a row changes loan balances and statuses
    // shown on customer details and on the dashboard.
    queryClient.invalidateQueries({ queryKey: [customerBase] }),
    queryClient.invalidateQueries({ queryKey: [dashboardBase] }),
    invalidateCustomerMetrics(),
  ]);

const invalidateCustomerFinancials = (userId: string) =>
  Promise.all([
    invalidateCustomerMetrics(),
    queryClient.invalidateQueries({ queryKey: [customerBase, userId] }),
    queryClient.invalidateQueries({ queryKey: [base] }),
    queryClient.invalidateQueries({ queryKey: [dashboardBase] }),
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

      if (request && request.state !== "REVIEWING") {
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
    if (data.period) formData.append("period", data.period);
    const res = await uploads.post<ApiRes<{ uploadId: string; period: string; rows: number }>>(base + "upload", formData);
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
    const res = await uploads.post<ApiRes<RepaymentValidationResult>>(
      base + "validate",
      formData,
    );
    return res.data;
  },
});

export const closeRepaymentPeriod = mutationOptions({
  mutationKey: [base, "close-period"],
  mutationFn: async (data: ClosePeriodDto) => {
    const res = await api.post<ApiRes<{
      periodId: string;
      label: string;
      closed: number;
      settled: number;
      failed: number;
      partial: number;
      penalties: number;
      penaltyTotal: number;
      proposals: number;
      errors: string[];
    }>>(base + "close-period", data);
    return res.data;
  },
  onSuccess: (data) =>
    invalidateRepaymentViews().then(() => toast.success(data.message)),
});

export const resolveRepayment = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "manual-resolution"],
    mutationFn: async (data: ManualRepaymentResolutionDto) => {
      const res = await api.patch<ApiRes<SingleRepaymentWithUserDto>>(
        `${base}inflows/${id}/manual-resolution`,
        data,
      );
      return res.data;
    },
    onSuccess: (data) =>
      invalidateRepaymentViews().then(() => toast.success(data.message)),
  });

export const requestVariationSchedule = mutationOptions({
  mutationKey: [variationBase, "generate"],
  mutationFn: generateVariation,
  onSuccess: (data, variables) => {
    toast.success(data.message);
    return queryClient.invalidateQueries({
      queryKey: variationKey(variables.period),
    });
  },
});

export const submitVariationSchedule = mutationOptions({
  mutationKey: [variationBase, "submit"],
  mutationFn: submitVariation,
  onSuccess: (data, variables) => {
    toast.success(data.message);
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: variationKey(variables.period) }),
      queryClient.invalidateQueries({ queryKey: [variationBase, "open"] }),
      // Submitting freezes deductions and opens the next month.
      invalidateRepaymentViews(),
    ]);
  },
});

export const revertVariationSchedule = mutationOptions({
  mutationKey: [variationBase, "revert"],
  mutationFn: revertVariation,
  onSuccess: (data) => {
    toast.success(data.message);
    // Every month's preview can change: the reverted one reopens and the next loses its deductions.
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: [variationBase] }),
      invalidateRepaymentViews(),
    ]);
  },
});

export const rejectLiquidation = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "reject-liquidation"],
    mutationFn: async (data: RejectLiquidationDto) => {
      const res = await api.patch<ApiRes<{ id: string; customerId: string; state: LiquidationStatus; amount: number; applied: number | null; outstanding: number | null }>>(
        `${base}inflows/${id}/reject-liquidation`,
        data,
      );
      return res.data;
    },
    onSuccess: (data) =>
      invalidateRepaymentViews()
        .then(() => toast.success(data.message)),
  });

export const acceptLiquidation = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "accept-liquidation"],
    mutationFn: async (data?: AcceptLiquidationDto) => {
      const res = await api.patch<ApiRes<{ id: string; customerId: string; state: LiquidationStatus; amount: number; applied: number | null; outstanding: number | null }>>(
        `${base}inflows/${id}/accept-liquidation`,
        data,
      );
      return res.data;
    },
    onSuccess: (data) => {
      const userId = data.data?.customerId;
      toast.success(data.message);
      if (!userId) return;

      void invalidateCustomerFinancials(userId);
      void waitForLiquidationCompletion(id, userId);
    },
  });
