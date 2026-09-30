"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import InputPassword from "@/components/ui/input-password";
import { saveUser } from "@/store/auth";
import { login } from "@/lib/mutations/user/auth";

const formSchema = z.object({
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
  password: z.string().min(1, {
    message: "Password is required.",
  }),
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function LoginForm() {
  const [activeTab, setActiveTab] = useState<"email" | "mobile">("email");
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      contact: "",
    },
  });

  const { mutateAsync, isPending } = useMutation(login);
  const emailValue = form.watch("email") || "";
  const contactValue = form.watch("contact") || "";
  const passwordValue = form.watch("password") || "";
  const identifierIsValid =
    activeTab === "email"
      ? z.string().email().safeParse(emailValue).success
      : /^[0-9]{11}$/.test(contactValue);
  const canSubmit = identifierIsValid && passwordValue.length > 0 && !isPending;

  function onSubmit(values: LoginFormValues) {
    const formData =
      activeTab === "email"
        ? { email: values.email || undefined, password: values.password }
        : { contact: values.contact || undefined, password: values.password };

    mutateAsync(formData).then((data) => {
      if (data.data?.token) {
        saveUser({ accessToken: data.data.token });
        toast.success("Login successful");
        router.push("/dashboard");
      } else {
        toast.error(data.message || "Login failed. Please try again.");
      }
    });
  }

  return (
    <div className="w-full space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-normal">Log in</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Welcome back. Choose your preferred sign-in method to continue.
        </p>
      </div>

      <div className="grid grid-cols-2 rounded-md border bg-muted p-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab("email")}
          className={`h-9 rounded-sm ${
            activeTab === "email"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Email
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab("mobile")}
          className={`h-9 rounded-sm ${
            activeTab === "mobile"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Mobile
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
          {activeTab === "email" && (
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      className="h-11 bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {activeTab === "mobile" && (
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="08012345678"
                      className="h-11 bg-background"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <InputPassword
                      placeholder="Enter your password"
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

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-primary hover:underline"
              aria-label="Forgot Password"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!canSubmit}
          >
            {isPending && <Loader2 className="animate-spin w-3 h-3" />}
            Login
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            {"Don't have a MicroBuilt account?"}{" "}
            <Link
              href="/sign-up"
              className="text-xs font-semibold text-primary hover:underline"
              aria-label="Sign up"
            >
              Sign up
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
