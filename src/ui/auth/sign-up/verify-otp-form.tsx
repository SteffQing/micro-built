"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { AxiosError } from "axios";
import { resendCode, verifyCode } from "@/lib/mutations/user/auth";
import getErrorMessage from "../utils";

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

  const { mutateAsync, isPending, isError, error } = useMutation(verifyCode);
  const resendMutation = useMutation(resendCode);

  const form = useForm<z.infer<typeof verificationSchema>>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      code: "",
    },
  });

  const verificationCode = form.watch("code");
  const isFormValid = verificationCode.length === 6 && /^\d{6}$/.test(verificationCode);

  function onSubmit(values: z.infer<typeof verificationSchema>) {
    if (!isFormValid) return;

    mutateAsync({
      code: values.code,
      email: email,
    }).then((data) => {
      if (data.data?.userId) {
        router.push("/login");
      }
    });
  }

  function handleResendCode() {
    resendMutation.mutate({ email });
  }

  return (
    <div className="w-full space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Verify Your Email</h1>
        <p className="text-muted-foreground">
          A 6-digit verification code has been sent to <span className="font-medium text-foreground">{email}</span>.
          Enter the code to verify your account.
        </p>
      </div>

      {(isError || resendMutation.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {isError && getErrorMessage(error, "Verification failed. Please try again.")}
            {resendMutation.isError &&
              getErrorMessage(resendMutation.error, "Failed to resend code. Please try again.")}
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
                <FormLabel className="text-sm font-medium">Enter Verification Code</FormLabel>
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
            <span className="text-sm text-muted-foreground">Didn&apos;t receive the code? </span>
            <Button
              type="button"
              onClick={handleResendCode}
              loading={resendMutation.isPending}
              disabled={resendMutation.isPending || !isFormValid}
              className="text-sm text-green-600 hover:underline font-medium disabled:opacity-50"
            >
              Resend Code
            </Button>
          </div>

          <Button
            type="submit"
            className="w-full h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isFormValid || isPending}
            loading={isPending}
          >
            Verify Account
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Want to use a different email?{" "}
            <button type="button" onClick={onGoBack} className="text-green-600 hover:underline font-medium">
              Go Back
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
}
