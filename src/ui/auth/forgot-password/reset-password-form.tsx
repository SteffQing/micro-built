"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
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
import { resetPassword } from "@/lib/mutations/user/auth";
import getErrorMessage from "../utils";

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
    message: "Passwords dont match",
    path: ["confirmPassword"],
  });

export default function ResetPasswordForm() {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const _token = searchParams.get("token");

  const { mutateAsync, isPending, isError, error } = useMutation(resetPassword);

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
      token: _token || "",
    }).then((data) => {
      if (data.data?.email) {
        router.push("/login");
      }
    });
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

      {(isError || !_token) && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="space-y-2 text-xs">
            {isError &&
              getErrorMessage(
                error,
                "Failed to reset password. Please try again.",
              )}
            {!_token && <p>This reset link is missing a valid token.</p>}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => router.push("/login")}
            >
              Back to login
            </Button>
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
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter your new password"
                      className="h-11 bg-background pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground/60"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
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
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your new password"
                      className="h-11 bg-background pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground/60"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
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
            disabled={!_token || isPending}
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
