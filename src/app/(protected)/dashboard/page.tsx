"use client";
import { useUserProvider } from "@/store/auth";
import { UserDashboardPage } from "@/ui/dashboard/user-dashboard";

export default function Page() {
  const { userRole, errorUser } = useUserProvider();
  return (
    <>
      {userRole === "CUSTOMER" ? (
        <UserDashboardPage />
      ) : userRole === "ADMIN" ? (
        <div>Admin</div>
      ) : (
        <div>UNKNOWN USER</div>
      )}
    </>
  );
}
