"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { AxiosError } from "axios";

const verificationSchema = z.object({
  code: z.string().length(6, {
    message: "Verification code must be exactly 6 digits.",
  }),
});

interface VerifyOtpFormProps {
  email: string;
  onGoBack: () => void;
}

export default function VerifyOtpForm({ email, onGoBack }: VerifyOtpFormProps) {
  const router = useRouter();

  // Verification mutation
  const verifyMutation = useMutation({
    mutationFn: async (data: { code: string; email: string }) => {
      const response = await api.post("/auth/verify-code", data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Account verified successfully!");
      router.push("/login");
    },
    onError: (error: unknown) => {
      let errorMessage = "Verification failed. Please try again.";

      if (error instanceof AxiosError && error.response?.data?.message) {
        errorMessage = Array.isArray(error.response.data.message)
          ? error.response.data.message.join(", ")
          : error.response.data.message;
      }

      // Handle specific error cases
      switch (error instanceof AxiosError && error.response?.status) {
        case 401:
          if (
            error instanceof AxiosError &&
            error.response?.data?.message.includes("expired")
          ) {
            errorMessage =
              "Verification code has expired. Please request a new one.";
          } else {
            errorMessage =
              "Invalid verification code. Please check and try again.";
          }
          break;
        default:
          break;
      }

      toast.error(errorMessage);
    },
  });

  // Resend code mutation
  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post("/auth/resend-code", { email });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Verification code sent successfully!");
    },
    onError: (error: unknown) => {
      let errorMessage = "Failed to resend code. Please try again.";

      if (error instanceof AxiosError && error.response?.status === 404) {
        errorMessage = "Email not found. Please check your email address.";
      } else if (error instanceof AxiosError && error.response?.data?.message) {
        errorMessage = Array.isArray(error.response.data.message)
          ? error.response.data.message.join(", ")
          : error.response.data.message;
      }

      toast.error(errorMessage);
    },
  });

  const form = useForm<z.infer<typeof verificationSchema>>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      code: "",
    },
  });

  const verificationCode = form.watch("code");
  const isFormValid =
    verificationCode.length === 6 && /^\d{6}$/.test(verificationCode);

  function onSubmit(values: z.infer<typeof verificationSchema>) {
    if (!isFormValid) return;

    verifyMutation.mutate({
      code: values.code,
      email: email,
    });
  }

  function handleResendCode() {
    resendMutation.mutate(email);
  }

  return (
    <div className="w-full space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Verify Your Email</h1>
        <p className="text-muted-foreground">
          A 6-digit verification code has been sent to{" "}
          <span className="font-medium text-foreground">{email}</span>. Enter
          the code to verify your account.
        </p>
      </div>

      {(verifyMutation.isError || resendMutation.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {verifyMutation.isError
              ? Array.isArray(
                  verifyMutation.error instanceof AxiosError &&
                    verifyMutation.error?.response?.data?.message
                )
                ? verifyMutation.error instanceof AxiosError &&
                  verifyMutation.error instanceof AxiosError &&
                  verifyMutation.error?.response?.data?.message.join(", ")
                : (verifyMutation.error instanceof AxiosError &&
                    verifyMutation.error?.response?.data?.message) ||
                  "Verification failed. Please try again."
              : Array.isArray(
                  resendMutation.error instanceof AxiosError &&
                    resendMutation.error?.response?.data?.message
                )
              ? resendMutation.error instanceof AxiosError &&
                resendMutation.error?.response?.data?.message.join(", ")
              : (resendMutation.error instanceof AxiosError &&
                  resendMutation.error?.response?.data?.message) ||
                "Failed to resend code. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Enter Verification Code
                </FormLabel>
                <FormControl>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} {...field}>
                      <InputOTPGroup className="space-x-3">
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="text-center">
            <span className="text-sm text-muted-foreground">
              Didn&apos;t receive the code?{" "}
            </span>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendMutation.isPending}
              className="text-sm text-green-600 hover:underline font-medium disabled:opacity-50"
            >
              {resendMutation.isPending ? "Resending..." : "Resend Code"}
            </button>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isFormValid || verifyMutation.isPending}
          >
            {verifyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Account"
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Want to use a different email?{" "}
            <button
              type="button"
              onClick={onGoBack}
              className="text-green-600 hover:underline font-medium"
            >
              Go Back
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
}
