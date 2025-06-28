"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import axios from "axios";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

// Step 1: Signup form schema
const signupSchema = z.object({
  fullName: z.string().min(2, {
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

// Step 2: Verification code schema
const verificationSchema = z.object({
  code: z.string().length(6, {
    message: "Verification code must be exactly 6 digits.",
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
const formSchema = z.object({
  fullName: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
  agreeToTerms: z.boolean().refine((value) => value, {
    message: "You must agree to the terms and conditions.",
  }),
});

export default function SignUpPage() {
  const [step, setStep] = useState<"signup" | "verification">("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      agreeToTerms: false,
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      // const response = await api.post("/auth/signup", data);
      const response = await axios.post(
        "https://micro-built.onrender.com/auth/signup",
        data
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      toast.success(
        data.message ||
          "Signup successful! Please check your email for verification."
      );
      setUserEmail(variables.email);
      setStep("verification");
      // router.push("/login");
    },
    onError: (error: any) => {
      console.log({ error });
      const errorMessage = Array.isArray(error.response?.data?.message)
        ? error.response.data.message.join(", ")
        : error.response?.data?.message || "Signup failed. Please try again.";
      toast.error(errorMessage);
    },
  });

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
    onError: (error: any) => {
      let errorMessage = "Verification failed. Please try again.";

      if (error.response?.data?.message) {
        errorMessage = Array.isArray(error.response.data.message)
          ? error.response.data.message.join(", ")
          : error.response.data.message;
      }

      // Handle specific error cases
      switch (error.response?.status) {
        case 401:
          if (error.response.data.message.includes("expired")) {
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
    onError: (error: any) => {
      let errorMessage = "Failed to resend code. Please try again.";

      if (error.response?.status === 404) {
        errorMessage = "Email not found. Please check your email address.";
      } else if (error.response?.data?.message) {
        errorMessage = Array.isArray(error.response.data.message)
          ? error.response.data.message.join(", ")
          : error.response.data.message;
      }

      toast.error(errorMessage);
    },
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      agreeToTerms: false,
    },
  });

  const verificationForm = useForm<z.infer<typeof verificationSchema>>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      code: "",
    },
  });

  const password = signupForm.watch("password");
  const agreeToTerms = signupForm.watch("agreeToTerms");
  const verificationCode = verificationForm.watch("code");

  // Check password requirements in real-time
  const passwordChecks = useMemo(() => {
    return passwordRequirements.map((req) => ({
      ...req,
      passed: req.test(password || ""),
    }));
  }, [password]);

  // Check if all password requirements are met
  const allPasswordRequirementsMet = passwordChecks.every(
    (check) => check.passed
  );

  // Check if signup form is valid for submission
  const isSignupFormValid = useMemo(() => {
    const { fullName, email } = signupForm.getValues();
    return (
      fullName.length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      allPasswordRequirementsMet &&
      agreeToTerms
    );
  }, [signupForm, allPasswordRequirementsMet, agreeToTerms]);

  // Check if verification form is valid
  const isVerificationFormValid =
    verificationCode.length === 6 && /^\d{6}$/.test(verificationCode);

  function onSignupSubmit(values: z.infer<typeof signupSchema>) {
    if (!isSignupFormValid) return;

    signupMutation.mutate({
      email: values.email,
      password: values.password,
    });
  }

  function onVerificationSubmit(values: z.infer<typeof verificationSchema>) {
    if (!isVerificationFormValid) return;

    verifyMutation.mutate({
      code: values.code,
      email: userEmail,
    });
  }

  function handleResendCode() {
    resendMutation.mutate(userEmail);
  }

  // Step 1: Signup Form
  if (step === "signup") {
    return (
      <div className="w-full mx-auto space-y-6 p-6">
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

        <Form {...signupForm}>
          <form
            onSubmit={signupForm.handleSubmit(onSignupSubmit)}
            className="space-y-4"
          >
            <FormField
              control={signupForm.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Full Name
                  </FormLabel>
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
              control={signupForm.control}
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
              control={signupForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">
                    Create Password
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className="h-12 pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground/60"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>

                  {/* Password Requirements */}
                  {password && (
                    <div className="mt-2 space-y-2">
                      {passwordChecks.map((check, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 text-sm"
                        >
                          {check.passed ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-red-500" />
                          )}
                          <span
                            className={
                              check.passed ? "text-green-600" : "text-red-600"
                            }
                          >
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={signupForm.control}
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
              className="w-full h-12 bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isSignupFormValid || signupMutation.isPending}
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
                className="text-green-600 hover:underline font-medium"
              >
                Login Here
              </Link>
            </div>
          </form>
        </Form>
      </div>
    );
  }
  // Step 2: Verification Form
  return (
    <div className="w-full  mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Verify Your Email</h1>
        <p className="text-muted-foreground">
          A 6-digit verification code has been sent to{" "}
          <span className="font-medium text-foreground">{userEmail}</span>.
          Enter the code to verify your account.
        </p>
      </div>

      {(verifyMutation.isError || resendMutation.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {verifyMutation.isError
              ? Array.isArray(verifyMutation.error?.response?.data?.message)
                ? verifyMutation.error.response.data.message.join(", ")
                : verifyMutation.error?.response?.data?.message ||
                  "Verification failed. Please try again."
              : Array.isArray(resendMutation.error?.response?.data?.message)
              ? resendMutation.error.response.data.message.join(", ")
              : resendMutation.error?.response?.data?.message ||
                "Failed to resend code. Please try again."}
          </AlertDescription>
        </Alert>
      )}

      <Form {...verificationForm}>
        <form
          onSubmit={verificationForm.handleSubmit(onVerificationSubmit)}
          className="space-y-4"
        >
          <FormField
            control={verificationForm.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  Enter Verification Code
                </FormLabel>
                <FormControl>
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} {...field}>
                      <InputOTPGroup>
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
              Didn't receive the code?{" "}
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
            disabled={!isVerificationFormValid || verifyMutation.isPending}
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
              onClick={() => setStep("signup")}
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

