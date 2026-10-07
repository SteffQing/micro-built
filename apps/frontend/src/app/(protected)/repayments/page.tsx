"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { AdminRepaymentsPage } from "@/ui/repayments/admin-repayments-view";
import { UserRepaymentsPage } from "@/ui/repayments/user-repayments-view";
import { MarketerRepaymentsPage } from "@/ui/marketer/repayments-page";
import { Suspense } from "react";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="table" />
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
