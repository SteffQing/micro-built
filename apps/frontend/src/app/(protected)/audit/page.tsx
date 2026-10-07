"use client";

import { PageSkeleton } from "@/components/page-skeleton";
import { useUserProvider } from "@/store/auth";
import PageTitle from "@/components/page-title";
import AuditLogTable from "@/ui/audit/audit-log-table";
import { AccessDenied } from "@/components/status-screen";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) {
    return (
      <PageSkeleton variant="table" />
    );
  }

  if (userRole !== "SUPER_ADMIN") {
    return <AccessDenied message="Only super admins can read the audit log." />;
  }

  return (
    <main className="p-3 lg:p-5 space-y-3 lg:space-y-5">
      <PageTitle title="Audit Log" />
      <AuditLogTable />
    </main>
  );
}
