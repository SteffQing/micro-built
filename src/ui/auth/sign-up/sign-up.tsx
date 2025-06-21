"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { LogoColored } from "@/components/logo";
import { Icons } from "@/components/icons";
// import { ForgotPasswordModal } from "@/components/forgot-password-modal";

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  console.log({ showForgotPassword });
  return (
    <>
      <div className="min-h-screen flex p-6 bg-muted gap-6">
        <div className="hidden lg:flex lg:w-1/2 relative rounded-xl overflow-hidden">
          <Image
            src="/man_illustration.png"
            alt="MicroBuilt Sign Up"
            fill
            className="object-cover"
          />
          {/* <div className="absolute inset-0" /> */}
          <div className="absolute top-8 left-4 bg-white p-2 rounded-lg">
            <LogoColored />
          </div>
          <div className="absolute bottom-8 left-1/2  -translate-x-1/2 text-left p-2 bg-gray-50/10 rounded-2xl backdrop-blur-sm w-[90%] max-w-2xl">
            <h2 className="text-xl font-semibold text-white">
              {"Let's Bring Your Financial Goals to Life"}
            </h2>
            <p className="text-muted-foreground text-sm">
              Access affordable loans anytime, anywhere with MicroBuilt
            </p>
            <div className="flex gap-2 mt-6 w-fit mx-auto">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <div className="w-2 h-2 bg-white/50 rounded-full"></div>
              <div className="w-2 h-2 bg-white/50 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Right Column - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-background rounded-2xl">
          <div className="w-full max-w-md space-y-6">
            <div className="space-y-2">
              <h1 className="text-xl font-bold">Login</h1>
              <p className="text-gray-600">Welcome Back to MicroBuilt</p>
            </div>

            <Button
              variant="outline"
              className="w-full h-12 border-green-200 text-green-700 hover:bg-green-50"
            >
              <Icons.google />
              Login with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or Continue With
                </span>
              </div>
            </div>

            <form className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-12 pr-10"
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
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" />
                  <label
                    htmlFor="remember"
                    className="text-sm text-muted-foreground"
                  >
                    Remember Password
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <Button className="w-full h-12 bg-gray-300 hover:bg-gray-400 text-muted-foreground">
                Login
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                {"Don't have a MicroBuilt account?"}{" "}
                <Link
                  href="/signup"
                  className="text-primary hover:underline font-medium"
                >
                  Signup Here
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* <ForgotPasswordModal
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
      /> */}
    </>
  );
}
