"use client";

import { PageSkeleton } from "@/components/page-skeleton";
import { useUserProvider } from "@/store/auth";
import PageTitle from "@/components/page-title";
import AuditLogTable from "@/ui/audit/audit-log-table";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) {
    return (
      <PageSkeleton variant="table" />
    );
  }

  if (userRole !== "SUPER_ADMIN") {
    return <div className="p-6 text-center text-muted-foreground">Only super admins can see the audit log.</div>;
  }

  return (
    <main className="p-3 lg:p-5 space-y-3 lg:space-y-5">
      <PageTitle title="Audit Log" />
      <AuditLogTable />
    </main>
  );
}
