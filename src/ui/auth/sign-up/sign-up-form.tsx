"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import InputPassword from "@/components/ui/input-password";
import { signup } from "@/lib/mutations/user/auth";
import getErrorMessage from "../utils";

const signupSchema = z.object({
  name: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
  email: z
    .string()
    .email({
      message: "Please enter a valid email address.",
    })
    .optional(),
  contact: z
    .string()
    .regex(/^[0-9]{11}$/, {
      message: "Please enter a valid contact number.",
    })
    .optional(),
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
      message: "Password must contain at least one special character (@$!%*?&).",
    }),
  agreeToTerms: z.boolean().refine((value) => value, {
    message: "You must agree to the terms and conditions.",
  }),
});

export default function SignupForm({ onSuccess }: { onSuccess: (email: string) => void }) {
  const { mutateAsync, isPending, isError, error } = useMutation(signup);

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      // agreeToTerms: false,
    },
  });

  function onSubmit(values: z.infer<typeof signupSchema>) {
    const { agreeToTerms, ...formData } = values;

    mutateAsync(formData).then((data) => {
      if (data.data?.userId && formData.email) onSuccess(formData.email);
    });
  }

  return (
    <div className="w-full space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Create Account</h1>
        <p className="text-muted-foreground">Create your MicroBuilt account to start enjoying our services.</p>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>{getErrorMessage(error, "Signup failed. Please try again.")}</AlertDescription>
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
                  <Input placeholder="Enter Full Name" className="h-12" {...field} />
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
                <FormLabel className="text-sm font-medium">Email Address</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Enter your email address" className="h-12" {...field} />
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
                <FormLabel className="text-sm font-medium">Create Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <InputPassword placeholder="Enter your password" className="h-12 pr-10" {...field} />
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
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    <Link href="/terms" className="text-green-600 hover:underline" aria-label="Terms and Conditions">
                      Agree to Terms and Conditions
                    </Link>
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className={`w-full ${isPending ? "opacity-50 cursor-not-allowed bg-muted hover:bg-muted/60 border" : ""}`}
            // variant={!isFormValid || signupMutation.isPending ? "secondary" : "default"}
            disabled={isPending}
            loading={isPending}
          >
            SignUp
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have a MicroBuilt account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium" aria-label="Login">
              Login Here
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
