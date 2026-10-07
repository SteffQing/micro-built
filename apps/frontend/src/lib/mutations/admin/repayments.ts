import { variationBase } from "@/lib/payroll/variations";
import { api, uploads } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base as customerBase } from "@/lib/queries/admin/customer";
import { customersOverview } from "@/lib/queries/admin/customers";
import { customersOverview as dashboardCustomersOverview, base as dashboardBase } from "@/lib/queries/admin/dashboard";
import { base as organizationsBase } from "@/lib/queries/admin/organizations";

const base = "/admin/repayments/";
const vouchersBase = "/admin/vouchers";

const invalidateCustomerMetrics = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: customersOverview.queryKey }),
    queryClient.invalidateQueries({
      queryKey: dashboardCustomersOverview.queryKey,
    }),
  ]);

export const invalidateRepaymentViews = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: [base] }),
    // A voucher (or a no payroll) settles a month and resolving a row changes loan balances and statuses
    // shown on customer details, on the dashboard and on the variations page.
    queryClient.invalidateQueries({ queryKey: [customerBase] }),
    queryClient.invalidateQueries({ queryKey: [dashboardBase] }),
    queryClient.invalidateQueries({ queryKey: [variationBase] }),
    queryClient.invalidateQueries({ queryKey: [organizationsBase] }),
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

const voucherForm = (data: UploadVoucherDto) => {
  const formData = new FormData();
  formData.append("file", data.file);
  formData.append("organizationId", data.organizationId);
  if (data.period) formData.append("period", data.period);
  return formData;
};

/** SUPER_ADMIN: an organization's voucher for a month (direct upload). It locks that month's variation. */
export const uploadVoucher = mutationOptions({
  mutationKey: [vouchersBase, "upload"],
  mutationFn: async (data: UploadVoucherDto) => {
    const res = await uploads.post<
      ApiRes<{
        voucherId: string;
        variationId: string;
        organization: { id: string; name: string };
        period: string;
        rows: number;
      }>
    >(vouchersBase, voucherForm(data));
    return res.data;
  },
  onSuccess: (data) => invalidateRepaymentViews().then(() => toast.success(data.message)),
});

export const validateVoucher = mutationOptions({
  mutationKey: [vouchersBase, "validate"],
  mutationFn: async (data: UploadVoucherDto) => {
    const res = await uploads.post<ApiRes<RepaymentValidationResult>>(`${vouchersBase}/validate`, voucherForm(data));
    return res.data;
  },
});

/** SUPER_ADMIN, confirmed: undoes a voucher while its month is still active and the next month has no variation. */
export const revertVoucher = mutationOptions({
  mutationKey: [vouchersBase, "revert"],
  mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
    const res = await api.delete<
      ApiRes<{ variationId: string; inflowsRemoved: number; penaltiesRemoved: number; proposalsWithdrawn: number }>
    >(`${vouchersBase}/${id}`, { data: { reason } });
    return res.data;
  },
  onSuccess: (data) => invalidateRepaymentViews().then(() => toast.success(data.message)),
});

export const resolveRepayment = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "manual-resolution"],
    mutationFn: async (data: ManualRepaymentResolutionDto) => {
      const res = await api.patch<ApiRes<ManualResolutionResultDto>>(
        `${base}inflows/${id}/manual-resolution`,
        data,
      );
      return res.data;
    },
    onSuccess: (data) =>
      invalidateRepaymentViews().then(() => {
        toast.success(data.message);
        // A rematch (PLAN_V2 R4b) either undid the penalty the voucher charged, or says why it couldn't.
        if (data.data?.penaltyCleared) toast.success("The penalty charged when the voucher landed was cleared.");
        if (data.data?.fallbackReason) {
          toast.warning(`The penalty stays: ${data.data.fallbackReason}`, { duration: 12_000 });
        }
      }),
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
