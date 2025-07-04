"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { unknown, z } from "zod";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Loader2, Router } from "lucide-react";
import { Icons } from "@/components/icons";
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
import { APIResponses, isAPIError } from "@/lib/queries/query-types";
import axios, { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import InputPassword from "@/components/ui/input-password";
import { saveUser } from "@/store/auth";

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(1, {
    message: "Password is required.",
  }),
  rememberPassword: z.boolean(),
});

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { push } = useRouter();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberPassword: false,
    },
  });

  const { mutateAsync, isPending, error, isSuccess } = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { email, password } = values;

      const { data } = await axios.post<APIResponses["login"]>(
        "https://micro-built.onrender.com/auth/login",
        { email, password }
      );
      console.log({ data });
      return data;
    },
    onSuccess: (data) => {
      if (!isAPIError(data) && data.data.token) {
        console.log(data.data.token);
        saveUser({ accessToken: data.data.token });
        toast.success("Login successful");
        push("/dashboard");
      } else {
        toast.error(data.message || "Login failed. Please try again.");
      }
    },
    onError: (error: unknown) => {
      let errorMessage = "Login failed. Please try again.";

      if (error instanceof AxiosError && error.response?.data?.message) {
        errorMessage = Array.isArray(error.response.data.message)
          ? error.response.data.message.join(", ")
          : error.response.data.message;
      }

      // Handle specific error cases
      switch ((error as AxiosError).response?.status) {
        case 400:
          errorMessage = "Please check your email and password format.";
          break;
        case 401:
          errorMessage = "Invalid email or password. Please try again.";
          break;
        case 404:
          errorMessage =
            "Account not found. Please check your email or sign up.";
          break;
        default:
          break;
      }

      toast.error(errorMessage);
    },
  });

  const { email, password } = form.watch();

  const isFormValid = useMemo(() => {
    const isEmailValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
    const isPasswordValid = (password || "").length > 0;
    return isEmailValid && isPasswordValid;
  }, [email, password]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!isFormValid) {
      toast.error("Please fill in all fields.");
      return;
    }
    mutateAsync(values);
  }

  return (
    <div className="w-full space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="text-muted-foreground">Welcome Back to MicroBuilt</p>
      </div>

      <Button
        variant="outline"
        className="w-full h-12 border-green-200 text-green-700 hover:bg-green-50 bg-transparent"
        type="button"
      >
        <Icons.google className="mr-2" />
        Login with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className=" border-t border-primary w-3/4" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or Continue With
          </span>
        </div>
      </div>

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
                <FormLabel className="text-sm font-medium">Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <InputPassword
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="h-12 pr-10"
                      {...field}
                    />
                    {/* <Input /> */}
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
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between">
            <FormField
              control={form.control}
              name="rememberPassword"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-1 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="text-sm text-primary  cursor-pointer">
                    Remember Password
                  </FormLabel>
                </FormItem>
              )}
            />
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot Password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="secondary"
            className="w-full bg-muted"
            disabled={isPending}
          >
            {isPending && <Loader2 className="animate-spin w-3 h-3" />}
            Login
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {"Don't have a MicroBuilt account?"}{" "}
            <Link
              href="/sign-up"
              className="text-primary hover:underline font-medium"
            >
              Signup Here
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
