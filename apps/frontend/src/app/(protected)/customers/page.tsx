"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { AdminCustomersPage } from "@/ui/customers/admin-view";
import { MarketerCustomersPage } from "@/ui/customers/marketer-view";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="table" />
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <p>Not applicable to customer</p>
      ) : userRole === "MARKETER" ? (
        <MarketerCustomersPage />
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        <AdminCustomersPage />
      ) : (
        !isUserLoading && errorUser && <div>An ERROR Occured</div>
      )}
    </>
  );
}
