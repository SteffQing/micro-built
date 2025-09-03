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
  const [showPassword, setShowPassword] = useState(false);
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

  function onSubmit(values: LoginFormValues) {
    const { contact, email, ...rest } = values;

    const formData = {
      ...rest,
      contact: contact || undefined,
      email: email || undefined,
    };

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
    <div className="w-full space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Login</h1>
        <p className="text-muted-foreground text-sm">
          Welcome Back to MicroBuilt
        </p>
      </div>

      <div className="flex mb-8 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab("email")}
          className={` mr-8 relative ${
            activeTab === "email"
              ? "text-primary"
              : "text-muted-foreground hover:text-muted-foreground/60"
          }`}
        >
          Email
          {activeTab === "email" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab("mobile")}
          className={` relative ${
            activeTab === "mobile"
              ? "text-primary"
              : "text-muted-foreground hover:text-muted-foreground/60"
          }`}
        >
          Mobile
          {activeTab === "mobile" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
          )}
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {activeTab === "email" && (
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Email"
                      className="h-12"
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
                      placeholder="Phone number"
                      className="h-12"
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
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="h-12 pr-10"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground/60 cursor-pointer"
                    ></button>
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
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="secondary"
            className="w-full bg-muted"
            disabled={isPending || !form.formState.isValid}
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
              Signup Here
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
