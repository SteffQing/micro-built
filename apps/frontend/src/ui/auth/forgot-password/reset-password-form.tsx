"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import InputPassword from "@/components/ui/input-password";
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
import { doResetPassword } from "@/lib/mutations/user/auth";
import { toast } from "sonner";

// Error helper — mutations throw Error (not AxiosError)
function getError(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  return fallback;
}

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .max(50, {
        message: "Password must be shorter than or equal to 50 characters.",
      })
      .regex(/[a-z]/, {
        message: "Password must contain at least one lowercase letter.",
      })
      .regex(/[A-Z]/, {
        message: "Password must contain at least one uppercase letter.",
      })
      .regex(/\d/, { message: "Password must contain at least one number." })
      .regex(/[@$!%*?&]/, {
        message:
          "Password must contain at least one special character (@$!%*?&).",
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // BUG-014: redirect to /forgot-password if no token in URL
  useEffect(() => {
    if (!token) {
      router.replace("/forgot-password");
    }
  }, [token, router]);

  const { mutateAsync, isPending, isError, error } =
    useMutation(doResetPassword);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  function onSubmit(values: z.infer<typeof resetPasswordSchema>) {
    mutateAsync({
      newPassword: values.newPassword,
      token: token!,
    }).then(() => {
      toast.success("Password reset successfully");
      router.push("/login");
    });
  }

  // Don't render the form while redirecting (no token)
  if (!token) {
    return null;
  }

  return (
    <div className="w-full space-y-5">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase text-primary">
          Account recovery
        </p>
        <h1 className="text-2xl font-semibold tracking-normal">
          Reset password
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Create a secure password for your MicroBuilt account.
        </p>
      </div>

      {isError && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">
            {getError(
              error,
              "Failed to reset password. Please try again.",
            )}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Enter Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <InputPassword
                      placeholder="Enter your new password"
                      className="h-11"
                      {...field}
                    />
                  </div>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Confirm Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <InputPassword
                      placeholder="Confirm your new password"
                      className="h-11"
                      showStrength={false}
                      {...field}
                    />
                  </div>
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isPending}
            loading={isPending}
          >
            Update password
          </Button>

          <div className="text-center text-xs leading-5 text-muted-foreground">
            By clicking &quot;Update password&quot;, you agree to
            MicroBuilt&apos;s{" "}
            <Link href="/terms" className="font-semibold text-primary hover:underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-primary hover:underline">
              Privacy Policy
            </Link>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            Need a new reset link?{" "}
            <Link
              href="/forgot-password"
              className="font-semibold text-primary hover:underline"
            >
              Request one
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
