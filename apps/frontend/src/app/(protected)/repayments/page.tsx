"use client";
import { useUserProvider } from "@/store/auth";
import { AdminRepaymentsPage } from "@/ui/repayments/admin-repayments-view";
import { UserRepaymentsPage } from "@/ui/repayments/user-repayments-view";
import { MarketerRepaymentsPage } from "@/ui/marketer/repayments-page";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { Suspense } from "react";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <div className="w-full h-full items-center flex justify-center">
          <div className="flex items-center flex-col">
            <p>Loading...</p>
            <Icon icon={icons.loaderCircle} size={24} className="text-primary animate-spin" />
          </div>
        </div>
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <UserRepaymentsPage />
      ) : userRole === "MARKETER" ? (
        <MarketerRepaymentsPage />
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        // The admin view reads ?tab and ?inflow (notification links), which needs a Suspense boundary.
        <Suspense>
          <AdminRepaymentsPage />
        </Suspense>
      ) : (
        !isUserLoading && errorUser && <div>An ERROR Occured</div>
      )}
    </>
  );
}
