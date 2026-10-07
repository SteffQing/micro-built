"use client";

import { PageSkeleton } from "@/components/page-skeleton";
import { useUserProvider } from "@/store/auth";
import PageTitle from "@/components/page-title";
import { Suspense } from "react";
import ChangeRequestsTable from "@/ui/change-requests/change-requests-table";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) {
    return (
      <PageSkeleton variant="table" />
    );
  }

  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return <div className="p-6 text-center text-muted-foreground">You do not have access to this page.</div>;
  }

  return (
    <main className="p-3 lg:p-5 space-y-3 lg:space-y-5">
      <PageTitle title="Approvals" />
      {/* The table reads ?request (notification links), which needs a Suspense boundary. */}
      <Suspense>
        <ChangeRequestsTable />
      </Suspense>
    </main>
  );
}
