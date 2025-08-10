"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import InputPassword from "@/components/ui/input-password";
import { signup } from "@/lib/mutations/user/auth";
import getErrorMessage from "../utils";

const signupSchema = z.object({
  name: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
  email: z
    .string()
    .optional()
    .refine(
      (val) =>
        val === undefined ||
        val === "" ||
        z.string().email().safeParse(val).success,
      {
        message: "Please enter a valid email address.",
      }
    ),
  contact: z
    .string()
    .optional()
    .refine(
      (val) => val === undefined || val === "" || /^[0-9]{11}$/.test(val),
      {
        message: "Please enter a valid contact number.",
      }
    ),
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

type SignUpFormValues = z.infer<typeof signupSchema>;

export default function SignupForm({
  onSuccess,
}: {
  onSuccess: (email: string) => void;
}) {
  const { mutateAsync, isPending, isError, error } = useMutation(signup);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: undefined,
      contact: undefined,
      password: "",
      agreeToTerms: false,
    },
  });

  const agreeToTerms = form.watch("agreeToTerms");

  function onSubmit(values: SignUpFormValues) {
    const { agreeToTerms, contact, email, ...rest } = values;
    const formData = {
      ...rest,
      contact: contact || undefined,
      email: email || undefined,
    };

    if (!agreeToTerms) return;

    mutateAsync(formData).then((data) => {
      if (data.data?.userId && email) onSuccess(email);
    });
  }

  return (
    <div className="w-full space-y-3 p-1">
      <div className="space-y-1">
        <h1 className="text-lg font-bold">Create Account</h1>
        <p className="text-muted-foreground text-xs">
          Create your MicroBuilt account to start enjoying our services.
        </p>
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">
            {getErrorMessage(error, "Signup failed. Please try again.")}
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
                <FormLabel className="text-xs font-medium">Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Full Name" {...field} />
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
                <FormLabel className="text-xs font-medium">
                  Email Address
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">
                  Phone Numbers
                </FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="Enter your contact number"
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
              <FormItem className="flex flex-row items-center space-x-1 space-y-0">
                <FormControl className="flex items-center justify-center p-1">
                  <Checkbox
                    className="w-3 h-3"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal cursor-pointer">
                    <Link
                      href="/terms"
                      className="text-green-700 hover:underline text-xs"
                      aria-label="Terms and Conditions"
                    >
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
            className={"w-full"}
            size="sm"
            disabled={!agreeToTerms || isPending}
            loading={isPending}
          >
            SignUp
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
