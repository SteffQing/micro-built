"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Icons } from "@/components/icons";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
    .refine((val) => val === undefined || val === "" || z.string().email().safeParse(val).success, {
      message: "Please enter a valid email address.",
    }),
  contact: z
    .string()
    .optional()
    .refine((val) => val === undefined || val === "" || /^[0-9]{11}$/.test(val), {
      message: "Please enter a valid contact number.",
    }),
  password: z.string().min(1, {
    message: "Password is required.",
  }),
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: undefined,
      password: "",
      contact: undefined,
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
    console.log(formData);

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
          <span className="bg-background px-2 text-muted-foreground">Or Continue With</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            name="contact"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">Phone Number</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="Enter your contact number" className="h-12" {...field} />
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
            <Link href="/forgot-password" className="text-sm text-primary hover:underline" aria-label="Forgot Password">
              Forgot Password?
            </Link>
          </div>

          <Button type="submit" variant="secondary" className="w-full bg-muted" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin w-3 h-3" />}
            Login
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {"Don't have a MicroBuilt account?"}{" "}
            <Link href="/sign-up" className="text-primary hover:underline font-medium" aria-label="Sign up">
              Signup Here
            </Link>
          </div>
        </form>
      </Form>
    </div>
  );
}
