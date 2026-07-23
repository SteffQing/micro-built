import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { base as customerBase } from "@/lib/queries/admin/customer";

const base = "/admin/repayments/";

export const uploadRepayment = mutationOptions({
  mutationKey: [base, "upload"],
  mutationFn: async (data: UploadRepaymentDto) => {
    const formData = new FormData();
    formData.append("file", data.file);
    const res = await api.post<ApiRes<AvatarDto>>(base + "upload", formData);
    return res.data;
  },
  onSuccess: (data) =>
    queryClient
      .invalidateQueries({ queryKey: [base] })
      .then(() => toast.success(data.message)),
});

export const validateRepayment = mutationOptions({
  mutationKey: [base, "validate"],
  mutationFn: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post<ApiRes<RepaymentValidationResult>>(
      base + "validate",
      formData
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
    queryClient
      .invalidateQueries({ queryKey: [base] })
      .then(() => toast.success(data.message)),
});


export const resolveRepayment = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "manual-resolution"],
    mutationFn: async (data: ManualRepaymentResolutionDto) => {
      const res = await api.patch<ApiRes<null>>(
        `${base}${id}/manual-resolution`,
        data
      );
      return res.data;
    },
    onSuccess: (data) =>
      // Refresh the repayments list/detail so the resolved row reflects its new
      // status; the worker applies the loan/customer update asynchronously.
      queryClient
        .invalidateQueries({ queryKey: [base] })
        .then(() => toast.success(data.message)),
  });

export const requestVariationSchedule = mutationOptions({
  mutationKey: [base, "variation"],
  mutationFn: async (data: GenerateMonthlyLoanScheduleDto) => {
    const res = await api.post<ApiRes<null>>(base + "variation", data);
    return res.data;
  },
  onSuccess: (data) => toast.success(data.message),
});

export const rejectLiquidation = (id: string) =>
  mutationOptions({
    mutationKey: [base, id, "reject-liquidation"],
    mutationFn: async () => {
      const res = await api.patch<ApiRes<CustomerUserId>>(
        `${base}${id}/reject-liquidation`
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
        `${base}${id}/accept-liquidation`
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
