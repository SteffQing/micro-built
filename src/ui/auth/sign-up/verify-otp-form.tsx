"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
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
  const isFormValid =
    verificationCode.length === 6 && /^\d{6}$/.test(verificationCode);

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
    <div className="w-full space-y-5">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase text-primary">
          Email verification
        </p>
        <h1 className="text-2xl font-semibold tracking-normal">
          Verify your email
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Enter the 6-digit code sent to{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
      </div>

      {(isError || resendMutation.isError) && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">
            {isError &&
              getErrorMessage(error, "Verification failed. Please try again.")}
            {resendMutation.isError &&
              getErrorMessage(
                resendMutation.error,
                "Failed to resend code. Please try again.",
              )}
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
                  Verification code
                </FormLabel>
                <FormControl>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} {...field}>
                      <InputOTPGroup className="space-x-2 sm:space-x-3">
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
            <span className="text-xs text-muted-foreground">
              Didn&apos;t receive the code?{" "}
            </span>
            <Button
              type="button"
              onClick={handleResendCode}
              loading={resendMutation.isPending}
              disabled={resendMutation.isPending}
              variant="link"
              className="h-auto p-0 text-xs font-semibold text-primary"
            >
              Resend code
            </Button>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!isFormValid || isPending}
            loading={isPending}
          >
            Verify account
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            Want to use a different email?{" "}
            <button
              type="button"
              onClick={onGoBack}
              className="font-semibold text-primary hover:underline"
            >
              Go back
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
}
