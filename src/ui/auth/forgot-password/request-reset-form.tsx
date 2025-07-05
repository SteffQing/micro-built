"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AxiosError } from "axios";
import { Input } from "@/components/ui/input";
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

const requestResetSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

interface RequestResetFormProps {
  onSuccess: (email: string) => void;
}

export default function RequestResetForm({ onSuccess }: RequestResetFormProps) {
  const requestResetMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const response = await api.post("/auth/forgot-password", data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message || "Password reset code sent to your email");
      onSuccess(variables.email);
    },
    onError: (error: unknown) => {
      let errorMessage = "Failed to send reset code. Please try again.";

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError<{ message?: string | string[] }>;
        
        // Extract error message from response
        if (axiosError.response?.data?.message) {
          errorMessage = Array.isArray(axiosError.response.data.message)
            ? axiosError.response.data.message.join(", ")
            : axiosError.response.data.message;
        }

        // Handle specific error cases
        if (axiosError.response?.status === 400) {
          errorMessage = "Please enter a valid email address.";
        } else if (axiosError.response?.status === 404) {
          errorMessage = "No account found with this email address. Please check your email or sign up.";
        }
      }

      toast.error(errorMessage);
    },
  });

  const form = useForm<z.infer<typeof requestResetSchema>>({
    resolver: zodResolver(requestResetSchema),
    defaultValues: {
      email: "",
    },
  });

  const email = form.watch("email");
  const isFormValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");

  function onSubmit(values: z.infer<typeof requestResetSchema>) {
    if (!isFormValid) return;
    requestResetMutation.mutate(values);
  }

  return (
    <div className="w-full space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Forgot Password</h1>
        <p className="text-muted-foreground">
          Enter your email address and we&apos;ll send you a verification code to
          reset your password.
        </p>
      </div>

      {requestResetMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {(() => {
              const error = requestResetMutation.error as AxiosError<{ message?: string | string[] }> | undefined;
              const message = error?.response?.data?.message;
              
              if (!message) return "Failed to send reset code. Please try again.";
              
              return Array.isArray(message) 
                ? message.join(", ")
                : message;
            })()}
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
                <FormLabel className="text-sm font-medium">
                  Email Address
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="Enter your email address"
                      className="h-12"
                      {...field}
                    />
                    {email && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isFormValid ? (
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                        ) : (
                          <div className="w-2 h-2 bg-red-500 rounded-full" />
                        )}
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!isFormValid || requestResetMutation.isPending}
          >
            {requestResetMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Code...
              </>
            ) : (
              "Send Verification Code"
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-green-600 hover:underline font-medium"
            >
              Back to Login
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
