"use client";

import { Icon, icons } from "@/components/icon";
import { useUserProvider } from "@/store/auth";
import PageTitle from "@/components/page-title";
import AuditLogTable from "@/ui/audit/audit-log-table";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Icon icon={icons.loaderCircle} size={24} className="animate-spin text-primary" />
      </div>
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
