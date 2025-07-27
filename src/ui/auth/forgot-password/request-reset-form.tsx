"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { forgotPassword } from "@/lib/mutations/user/auth";
import getErrorMessage from "../utils";

const requestResetSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

interface RequestResetFormProps {
  onSuccess: (email: string) => void;
}

export default function RequestResetForm({ onSuccess }: RequestResetFormProps) {
  const { mutateAsync, isPending, isError, error } = useMutation(forgotPassword);

  const form = useForm<z.infer<typeof requestResetSchema>>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(values: z.infer<typeof requestResetSchema>) {
    mutateAsync(values).then((data) => {
      if (data.data?.email) {
        onSuccess(data.data.email);
      }
    });
  }

  return (
    <div className="w-full space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Forgot Password</h1>
        <p className="text-muted-foreground">
          Enter your email address and we&apos;ll send you a verification code to reset your password.
        </p>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {getErrorMessage(error, "Failed to request password reset. Please try again.")}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Email Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type="email" placeholder="Enter your email address" className="h-12" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            loading={isPending}
          >
            Send Verification Code
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link href="/login" className="text-green-600 hover:underline font-medium">
              Back to Login
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
