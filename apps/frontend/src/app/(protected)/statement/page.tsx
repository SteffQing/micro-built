"use client";

import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { CustomerStatementTable } from "@/ui/statement/statement-table";
import { AccessDenied } from "@/components/status-screen";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="table" />
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <CustomerStatementTable />
      ) : (
        <AccessDenied message="The statement is a customer's own record of their loan." />
      )}
    </>
  );
}
