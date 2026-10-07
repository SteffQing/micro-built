"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { AdminCustomersPage } from "@/ui/customers/admin-view";
import { MarketerCustomersPage } from "@/ui/customers/marketer-view";
import { AccessDenied, AccountLoadError } from "@/components/status-screen";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="table" />
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <AccessDenied message="Customer records are for MicroBuilt staff. Your own details are in Settings." />
      ) : userRole === "MARKETER" ? (
        <MarketerCustomersPage />
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        <AdminCustomersPage />
      ) : (
        errorUser && <AccountLoadError />
      )}
    </>
  );
}
