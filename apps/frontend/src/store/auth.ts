"use client";

import { authClient, signOut } from "@/lib/auth-client";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { getUser } from "@/lib/queries/user";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { beginSignOut } from "@/lib/axios";
import * as Sentry from "@sentry/nextjs";

const authRoutes = ["/login", "/sign-up", "/verify-code", "/forgot-password", "/reset-password", "/two-factor"];
const publicRoutes = ["/", "/about"];

// Set while signing out, for every component reading useUserProvider: between the cookie going and the page
// leaving, queries fail with 401, and pages would flash their error state ("An ERROR Occured").
let leaving = false;
const leavingListeners = new Set<() => void>();
function setLeaving() {
  leaving = true;
  leavingListeners.forEach((listener) => listener());
}
function subscribeLeaving(listener: () => void) {
  leavingListeners.add(listener);
  return () => leavingListeners.delete(listener);
}

export function useUserProvider() {
  const router = useRouter();
  const pathname = usePathname();
  const signingOut = useSyncExternalStore(subscribeLeaving, () => leaving, () => false);

  const isAuthPage = authRoutes.some((r) => pathname.startsWith(r));
  const isPublicPage = publicRoutes.includes(pathname);

  // better-auth session (cookie-based, no localStorage).
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const sessionUser = session?.user ?? null;

  // GET /user for role, twoFactorEnabled and hasPasskey (not on the better-auth session).
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
  const hasPasskey = user?.hasPasskey;
  // Only super admins must have a strong factor (2FA or a passkey) to use the dashboard; the API answers 403
  // TWO_FACTOR_SETUP_REQUIRED until they do. Everyone else is asked for one only by a gated action.
  const needsStrongFactor = userRole === "SUPER_ADMIN" && twoFactorEnabled === false && hasPasskey === false;

  useEffect(() => {
    if (needsStrongFactor && !pathname.startsWith("/settings")) {
      router.replace("/settings?view=authentication&setup=2fa");
    }
  }, [needsStrongFactor, pathname, router]);

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

  // Pages show their loader from here on; a full load of /login then starts with nothing cached.
  const logout = async () => {
    setLeaving();
    beginSignOut();
    await queryClient.cancelQueries();
    let cleared = true;
    try {
      const res = await signOut();
      cleared = !res.error;
    } catch {
      cleared = false;
    }
    Sentry.setUser(null);
    // If the cookie couldn't be cleared, `expired` lets the login page through the proxy instead of bouncing back.
    window.location.replace(cleared ? "/login" : "/login?expired=1");
  };

  return {
    user,
    userRole,
    twoFactorEnabled,
    hasPasskey,
    needsStrongFactor,
    userDetails,
    isUserLoading: signingOut || isSessionLoading || isUserLoading,
    errorUser: signingOut ? null : errorUser,
    logout,
  };
}

// Legacy exports removed — auth is cookie-based, no localStorage reads.
// Components that imported clearUser/saveUser/getSavedUser/logout from here
// should use authClient methods or the logout from useUserProvider instead.
