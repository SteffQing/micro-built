"use client";

import { userQuery } from "@/lib/queries/user-query";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { z } from "zod";

const userAuthoritySchema = z.object({
  accessToken: z.string(),
});

type UserAuthority = z.infer<typeof userAuthoritySchema>;
const authWebRoutes = [
  "/login",
  "/sign-up",
  "/verify-code",
  "/resend-code",
  "/forgot-password",
  "/reset-password",
];

export const useUserProvider = () => {
  const { push } = useRouter();
  const pathname = usePathname();

  const userAuthority = getSavedUser();

  const shouldFetchUser =
    !authWebRoutes.includes(pathname) && userAuthority?.accessToken !== "";

  const logout = () => {
    saveUser({ accessToken: "" });
    push("/login");
    queryClient.removeQueries(userQuery);
  };

  const {
    data: userDetails,
    isLoading: isUserLoading,
    error: errorUser,
  } = useQuery({
    ...userQuery,
    enabled: shouldFetchUser,
  });

  const user = userDetails?.data?.user;
  const userRole = user?.role;
  return {
    user,
    userRole,
    userDetails,
    isUserLoading,
    errorUser,
    logout,
  };
};

export function clearUser() {
  if (typeof window === "undefined") {
    return null;
  }
  window.localStorage.removeItem("userAuthority");
}

export function saveUser(userAuthority: UserAuthority) {
  if (typeof window === "undefined") {
    return null;
  }
  window.localStorage.setItem("userAuthority", JSON.stringify(userAuthority));
}

export function getSavedUser() {
  if (typeof window === "undefined") {
    return null;
  }
  const user = window.localStorage.getItem("userAuthority");
  if (!user) return null;
  try {
    const result = userAuthoritySchema.safeParse(JSON.parse(user));
    return result.success ? result.data : null;
  } catch {
    clearUser();
    return null;
  }
}

export function logout() {
  clearUser();
  queryClient.invalidateQueries(userQuery);
  window.location.href = "/login";
}
