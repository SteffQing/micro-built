"use client";
import { useUserProvider } from "@/store/auth";
import { AdminDashboardPage } from "@/ui/dashboard/admin-dashboard";
import { UserDashboardPage } from "@/ui/dashboard/user-dashboard";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {!isUserLoading && userRole === "CUSTOMER" ? (
        <UserDashboardPage />
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        <AdminDashboardPage />
      ) : !isUserLoading && errorUser ? (
        <div>An ERROR Occured</div>
      ) : (
        <div>UNKNOWN Eror occured contact admin</div>
      )}
    </>
  );
}
