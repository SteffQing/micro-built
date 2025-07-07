"use client";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
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
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { api } from "@/lib/axios";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/\d/, "Password must contain at least one number")
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        "Password must contain at least one special character"
      ),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof passwordSchema>;

interface UpdatePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

interface UpdatePasswordResponse {
  message: string;
}

interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export function UpdatePassword() {
 const [showCurrentPassword, setShowCurrentPassword] = useState(false);
 const [showNewPassword, setShowNewPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const updatePassword = useMutation({
    mutationFn: async (
      data: UpdatePasswordRequest
    ): Promise<UpdatePasswordResponse> => {
      const response = await api.patch<UpdatePasswordResponse>(
        "/user/password",
        data
      );
      return response.data;
    },
    onSuccess: (data: UpdatePasswordResponse) => {
      toast.success(data.message || "Password updated successfully!");
    },
    onError: (error: {
      response?: {
        status?: number;
        data?: { message?: string; statusCode?: number; error?: string };
      };
    }) => {
      const errorData = error.response?.data;
      const statusCode = error.response?.status || errorData?.statusCode;

      // Handle specific error cases based on swagger docs
      switch (statusCode) {
        case 401:
          toast.error("Unauthorized. Please log in again.");
          // Optionally redirect to login or refresh token
          break;
        case 404:
          toast.error("User not found. Please contact support.");
          break;
        case 400:
          // Handle validation errors
          toast.error(errorData?.message || "Invalid password data provided");
          break;
        case 422:
          // Handle validation errors
          toast.error(errorData?.message || "Password validation failed");
          break;
        case 500:
          toast.error("Server error. Please try again later.");
          break;
        default:
          toast.error(
            errorData?.message || "Failed to update password. Please try again."
          );
      }
    },
  });

 const form = useForm<FormData>({
   resolver: zodResolver(passwordSchema),
   defaultValues: {
     currentPassword: "",
     newPassword: "",
     confirmPassword: "",
   },
 });

 const newPassword = form.watch("newPassword");

 // Password validation
 const validatePassword = (password: string): PasswordValidation => {
   return {
     minLength: password.length >= 8,
     hasUppercase: /[A-Z]/.test(password),
     hasLowercase: /[a-z]/.test(password),
     hasNumber: /\d/.test(password),
     hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
   };
 };

 const passwordValidation = validatePassword(newPassword || "");

 const onSubmit = async (data: FormData) => {
   try {
     const requestData: UpdatePasswordRequest = {
       oldPassword: data.currentPassword,
       newPassword: data.newPassword,
     };

     await updatePassword.mutateAsync(requestData);

     // Reset form on success
     form.reset();

     // Reset password visibility states
     setShowCurrentPassword(false);
     setShowNewPassword(false);
     setShowConfirmPassword(false);
   } catch (error) {
     // Error is already handled in the mutation's onError callback
     console.error("Password update failed:", error);
   }
 };

  return (
    <div className="max-w-4xl">
      <div className="p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-muted-foreground">
                Update Password
              </h2>
              <p className="text-muted-foreground">
                You can change and confirm your new password here.
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 max-w-md"
          >
            {/* Current Password */}
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showCurrentPassword ? "text" : "password"}
                        placeholder="Enter your current password"
                        disabled={updatePassword.isPending}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrentPassword(!showCurrentPassword)
                        }
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        disabled={updatePassword.isPending}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* New Password */}
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter your new password"
                        disabled={updatePassword.isPending}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        disabled={updatePassword.isPending}
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />

                  {/* Password Requirements */}
                  {newPassword && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Password Requirements:
                      </p>
                      <div className="space-y-1">
                        {[
                          {
                            key: "minLength",
                            label: "At least 8 characters",
                            valid: passwordValidation.minLength,
                          },
                          {
                            key: "hasUppercase",
                            label: "One uppercase letter",
                            valid: passwordValidation.hasUppercase,
                          },
                          {
                            key: "hasLowercase",
                            label: "One lowercase letter",
                            valid: passwordValidation.hasLowercase,
                          },
                          {
                            key: "hasNumber",
                            label: "One number",
                            valid: passwordValidation.hasNumber,
                          },
                          {
                            key: "hasSpecialChar",
                            label: "One special character",
                            valid: passwordValidation.hasSpecialChar,
                          },
                        ].map((requirement) => (
                          <div
                            key={requirement.key}
                            className="flex items-center gap-2 text-sm"
                          >
                            {requirement.valid ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <div className="w-3 h-3 rounded-full border border-gray-300" />
                            )}
                            <span
                              className={
                                requirement.valid
                                  ? "text-green-600"
                                  : "text-gray-500"
                              }
                            >
                              {requirement.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* Confirm New Password */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your new password"
                        disabled={updatePassword.isPending}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        disabled={updatePassword.isPending}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  {field.value && newPassword === field.value && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Passwords match
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={updatePassword.isPending}
            >
              {updatePassword.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating Password...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
