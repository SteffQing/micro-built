"use client";
import { useUserProvider } from "@/store/auth";
import { AdminRepaymentsPage } from "@/ui/repayments/admin-repayments-view";
import { UserRepaymentsPage } from "@/ui/repayments/user-repayments-view";
import { Loader2 } from "lucide-react";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <div className="w-full h-full items-center flex justify-center">
          <div className="flex items-center flex-col">
            <p>Loading...</p>
            <Loader2 className="text-primary animate-spin w-6 h-6" />
          </div>
        </div>
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <UserRepaymentsPage />
      ) : userRole === "ADMIN" || "SUPER-ADMIN" ? (
        <AdminRepaymentsPage />
      ) : (
        !isUserLoading && errorUser && <div>An ERROR Occured</div>
      )}
    </>
  );
}
