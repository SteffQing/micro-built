"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const { mutateAsync, isPending, isError, error } =
    useMutation(forgotPassword);

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
    <div className="w-full space-y-5">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase text-primary">
          Account recovery
        </p>
        <h1 className="text-2xl font-semibold tracking-normal">
          Forgot password
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Enter your email address and we&apos;ll send reset instructions.
        </p>
      </div>

      {isError && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">
            {getErrorMessage(
              error,
              "Failed to request password reset. Please try again.",
            )}
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
                      placeholder="name@company.com"
                      className="h-11 bg-background"
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
            loading={isPending}
          >
            Send reset instructions
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            Remember your password?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
            >
              Back to login
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
