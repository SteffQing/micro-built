import { userQueryOptions } from "@/lib/queries/user-query";
import { useQuery } from "@tanstack/react-query";

export const useUser = () => {
  const { data, isLoading, isError, error } = useQuery({
    ...userQueryOptions,
  });

  const user = data?.data.user;
  const userId = user?.id;
  const userEmail = user?.email;
  const userRole = user?.role;
  const userName = user?.name;
  const userStatus = user?.status;

  const avatar = user?.avatar || "/profile_dummy";

  const isAdmin = user?.role === "ADMIN";
  const isCustomer = userRole === "CUSTOMER";

  return {
    user,
    userId,
    userRole,
    userName,
    userEmail,
    userStatus,
    avatar,

    isAdmin,
    isCustomer,

    isLoading,

    isError,

    error,
  };
};
