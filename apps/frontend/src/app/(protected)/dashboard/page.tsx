"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { AdminDashboardPage } from "@/ui/dashboard/admin-dashboard";
import { UserDashboardPage } from "@/ui/dashboard/user-dashboard";
import { MarketerDashboardPage } from "@/ui/marketer/dashboard";
import { Suspense } from "react";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="dashboard" />
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <UserDashboardPage />
      ) : userRole === "MARKETER" ? (
        <MarketerDashboardPage />
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        // The admin dashboard reads ?variation (links sent before variations got their own page), which needs a
        // Suspense boundary.
        <Suspense>
          <AdminDashboardPage />
        </Suspense>
      ) : (
        !isUserLoading && errorUser && <div>An ERROR Occured</div>
      )}
    </>
  );
}
