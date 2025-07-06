"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import InputPassword from "@/components/ui/input-password";

const signupSchema = z.object({
  name: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
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
  agreeToTerms: z.boolean().refine((value) => value, {
    message: "You must agree to the terms and conditions.",
  }),
});

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  {
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    label: "One uppercase letter",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: "One lowercase letter",
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: "One number",
    test: (password) => /\d/.test(password),
  },
  {
    label: "One special character (@$!%*?&)",
    test: (password) => /[@$!%*?&]/.test(password),
  },
];

interface SignupFormProps {
  onSuccess: (email: string) => void;
}

interface SignupResponse {
  message?: string;
  // Add other expected response fields here if any
}

export default function SignupForm({ onSuccess }: SignupFormProps) {
  const signupMutation = useMutation<
    SignupResponse,
    { response?: { data?: { message?: string | string[] } } },
    { name: string; email: string; password: string }
  >({
    mutationFn: async (data: {
      name: string;
      email: string;
      password: string;
    }) => {
      console.log({ data });
      const response = await api.post<SignupResponse>("/auth/signup", data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      console.log({ data });
      toast.success(
        data.message ||
          "Signup successful! Please check your email for verification."
      );

      console.log({ data });
      onSuccess(variables.email);
    },
    onError: (error) => {
      console.log({ error });
      const errorMessage = Array.isArray(error.response?.data?.message)
        ? error.response.data.message.join(", ")
        : error.response?.data?.message || "Signup failed. Please try again.";
      console.log({ errorMessage });
      toast.error(errorMessage);
    },
  });

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      agreeToTerms: false,
    },
  });

  // Watch form values to trigger re-renders when they change
  const watchedValues = form.watch();

  const passwordChecks = useMemo(() => {
    const password = watchedValues.password;
    return passwordRequirements.map((req) => ({
      ...req,
      passed: req.test(password || ""),
    }));
  }, [watchedValues.password]);

  // Check if all password requirements are met
  const allPasswordRequirementsMet = passwordChecks.every(
    (check) => check.passed
  );

  // Check if form is valid for submission
  const isFormValid = useMemo(() => {
    const { name, email, agreeToTerms } = watchedValues;
    return (
      name.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
      allPasswordRequirementsMet &&
      agreeToTerms
    );
  }, [watchedValues, allPasswordRequirementsMet]);

  function onSubmit(values: z.infer<typeof signupSchema>) {
    if (!isFormValid) return;

    signupMutation.mutate({
      name: values.name,
      email: values.email,
      password: values.password,
    });
  }

  console.log({ isFormValid, signupMutation: signupMutation.isPending });

  return (
    <div className="w-full space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="text-muted-foreground">
          Create your MicroBuilt account to start enjoying our services.
        </p>
      </div>

      {signupMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {Array.isArray(signupMutation.error?.response?.data?.message)
              ? signupMutation.error.response.data.message.join(", ")
              : signupMutation.error?.response?.data?.message ||
                "Signup failed. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Full Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter Full Name"
                    className="h-12"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Email Address
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    className="h-12"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Create Password
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <InputPassword
                      placeholder="Enter your password"
                      className="h-12 pr-10"
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
            name="agreeToTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    Agree to{" "}
                    <Link
                      href="/terms"
                      className="text-green-600 hover:underline"
                      aria-label="Terms and Conditions"
                    >
                      Terms and Conditions
                    </Link>
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className={`w-full ${
              !isFormValid || signupMutation.isPending
                ? "opacity-50 cursor-not-allowed bg-muted hover:bg-muted/60 border"
                : ""
            }`}
            variant={
              !isFormValid || signupMutation.isPending ? "secondary" : "default"
            }
            disabled={!isFormValid || signupMutation.isPending}
          >
            {signupMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              "Signup"
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have a MicroBuilt account?{" "}
            <Link
              href="/login"
              className="text-primary hover:underline font-medium"
              aria-label="Login"
            >
              Login Here
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
