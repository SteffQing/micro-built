"use client";

import { authClient, signOut } from "@/lib/auth-client";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { getUser } from "@/lib/queries/user";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

const authRoutes = ["/login", "/sign-up", "/verify-code", "/forgot-password", "/reset-password", "/two-factor"];
const publicRoutes = ["/", "/about"];

export function useUserProvider() {
  const router = useRouter();
  const pathname = usePathname();

  const isAuthPage = authRoutes.some((r) => pathname.startsWith(r));
  const isPublicPage = publicRoutes.includes(pathname);

  // better-auth session (cookie-based, no localStorage).
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const sessionUser = session?.user ?? null;

  // GET /user for role + twoFactorEnabled (not on the better-auth session).
  const {
    data: userDetails,
    isLoading: isUserLoading,
    error: errorUser,
  } = useQuery({
    ...getUser,
    enabled: !!sessionUser && !isAuthPage && !isPublicPage,
  });

  const user = userDetails?.data;
  const userRole = user?.role;
  const twoFactorEnabled = user?.twoFactorEnabled;
  const isAdmin = userRole && userRole !== "CUSTOMER" && userRole !== "MARKETER";

  // Admin without 2FA → force security setup (release blocker §0.2).
  useEffect(() => {
    if (isAdmin && twoFactorEnabled === false && !pathname.startsWith("/settings")) {
      router.replace("/settings?view=authentication&setup=2fa");
    }
  }, [isAdmin, twoFactorEnabled, pathname, router]);

  // Optimistic redirects.
  useEffect(() => {
    if (isPublicPage) return;

    if (sessionUser && !isSessionLoading && isAuthPage) {
      router.push("/dashboard");
    }
  }, [sessionUser, isSessionLoading, isAuthPage, isPublicPage, router]);

  // Sentry user tracking.
  useEffect(() => {
    if (user) {
      Sentry.setUser({ id: user.id, email: user.email ?? undefined, username: user.name });
    } else {
      Sentry.setUser(null);
    }
  }, [user]);

  const logout = async () => {
    await signOut();
    queryClient.clear();
    Sentry.setUser(null);
    router.replace("/login");
  };

  return {
    user,
    userRole,
    twoFactorEnabled,
    userDetails,
    isUserLoading: isSessionLoading || isUserLoading,
    errorUser,
    logout,
  };
}

// Legacy exports removed — auth is cookie-based, no localStorage reads.
// Components that imported clearUser/saveUser/getSavedUser/logout from here
// should use authClient methods or the logout from useUserProvider instead.
