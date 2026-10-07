"use client";

import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { CustomerStatementTable } from "@/ui/statement/statement-table";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="table" />
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <CustomerStatementTable />
      ) : (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          This page is for customer accounts only.
        </div>
      )}
    </>
  );
}
