import { isAPISuccess, User } from "@/lib/queries/query-types";
import { userQuery } from "@/lib/queries/user-query";
import { queryClient } from "@/providers/tanstack-react-query-provider";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const authEndpoints = [
  "/login",
  "/sign-up",
  "/verify-code",
  "/resend-code",
  "/forgot-password",
  "/reset-password",
];

const userDetailsSchema = z.object({
  accessToken: z.string().optional(),
  role: z.enum(["CUSTOMER", "ADMIN", "MODERATOR"]).optional(),
  profile: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    contact: z.string().optional(),
    avatar: z.string().optional(),
    email: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  }),
});

type UserDetails = z.infer<typeof userDetailsSchema>;

// interface AuthStore {
//   user: UserDetails | null;
//   setUser: (userDetails: UserDetails) => void;
//   clearUser: () => void;
// }
interface AuthStore {
  user: UserDetails | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (userDetails: UserDetails) => void;
  updateUserProfile: (profileData: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;

  // Computed values
  isAdmin: () => boolean;
  isModerator: () => boolean;
  isCustomer: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (userDetails) => {
        set({
          user: userDetails,
          isAuthenticated: true,
          error: null,
        });
      },

      updateUserProfile: (profileData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              profile: { ...currentUser.profile, ...profileData },
            },
          });
        }
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
        queryClient.removeQueries(userQuery);
        localStorage.removeItem("overview-filter");
        window.location.href = "/login";
      },

      isAdmin: () => get().user?.role === "ADMIN",
      isModerator: () => get().user?.role === "MODERATOR",
      isCustomer: () => get().user?.role === "CUSTOMER",
    }),
    {
      name: "auth-store",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export const useUser = () => {
  useQuery(userQuery);
};

export const useUserProvider = () => {
  const { push } = useRouter();
  const pathname = usePathname();

  // const { data, isLoading, error } = useUser();

  const { setUser, setLoading, setError, user, isAuthenticated } = useAuthStore();

  const shouldFetchUser =
    !authEndpoints.includes(pathname) && isAuthenticated;

  const { data, isLoading, error } = useQuery({
    ...userQuery,
    enabled: shouldFetchUser,
  });
  useEffect(() => {
    setLoading(isLoading);
    setError(error?.message || null);
    if (data) {
      if (isAPISuccess(data)) {
        setUser({
          role: data.role,
          profile: {
            id: data.id,
            name: data.name,
            contact: data.contact,
            avatar: data.avatar,
            email: data.email,
            status: data.status,
          },
        });
      } else {
        setError(data.message);
      }
    }
  }, [
    data,
    isLoading,
    error,
    setUser,
    setLoading,
    setError,
    user,
    push,
    pathname,
  ]);

  useEffect(() => {
    console.log("accessToken:", user?.accessToken);
    console.log("pathname:", pathname);
    console.log("authEndpoints:", authEndpoints);
    if (!user?.accessToken && !authEndpoints.includes(pathname)) {
      toast.error("Not authorized, Please log in again.");
      push("/login");
    }
  }, [user, pathname, push]);
};
