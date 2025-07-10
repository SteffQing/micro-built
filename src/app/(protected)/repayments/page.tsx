"use client";
import { useUserProvider } from "@/store/auth";
import { AdminRepaymentsPage } from "@/ui/repyments/admin-repayments-view";
import { UserRepaymentsPage } from "@/ui/repyments/user-repayments-view";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {!isUserLoading && userRole === "CUSTOMER" ? (
        <UserRepaymentsPage />
      ) : userRole === "ADMIN" || "SUPER-ADMIN" ? (
        <AdminRepaymentsPage />
      ) : !isUserLoading && errorUser ? (
        <div>An ERROR Occured</div>
      ) : (
        <div>Loading...</div>
      )}
    </>
  );
}
