import { api } from "@/lib/axios";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { mutationOptions } from "@tanstack/react-query";
import { toast } from "sonner";

const base = "/auth/";

export const signup = mutationOptions({
  mutationKey: [base, "signup"],
  mutationFn: async (data: SignupBodyDto) => {
    const res = await api.post<ApiRes<SignupResponseDto>>(base + "signup", data);
    return res.data;
  },
  onSuccess: (data) => toast.success(data.message),
});

export const login = mutationOptions({
  mutationKey: [base, "login"],
  mutationFn: async (data: LoginBodyDto) => {
    const res = await api.post<ApiRes<LoginDataDto>>(base + "login", data);
    return res.data;
  },
  onSuccess: (data) => toast.success(data.message),
});

export const verifyCode = mutationOptions({
  mutationKey: [base, "verify-code"],
  mutationFn: async (data: VerifyCodeBodyDto) => {
    const res = await api.post<ApiRes<VerifyCodeResponseDto>>(base + "verify-code", data);
    return res.data;
  },
  onSuccess: (data) => toast.success(data.message),
});

export const forgotPassword = mutationOptions({
  mutationKey: [base, "forgot-password"],
  mutationFn: async (data: ForgotPasswordBodyDto) => {
    const res = await api.post<ApiRes<ForgotPasswordResponseDto>>(base + "forgot-password", data);
    return res.data;
  },
  onSuccess: (data) => toast.success(data.message),
});

export const resetPassword = mutationOptions({
  mutationKey: [base, "reset-password"],
  mutationFn: async (data: ResetPasswordBodyDto) => {
    const res = await api.post<ApiRes<ResetPasswordResponseDto>>(base + "reset-password", data);
    return res.data;
  },
  onSuccess: (data) => toast.success(data.message),
});

export const resendCode = mutationOptions({
  mutationKey: [base, "resend-code"],
  mutationFn: async (data: ResendCodeBodyDto) => {
    const res = await api.post<ApiRes<VerifyCodeResponseDto>>(base + "resend-code", data);
    return res.data;
  },
  onSuccess: (data) => toast.success(data.message),
});
