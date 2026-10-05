"use client";

import { Icon, icons } from "@/components/icon";
import { useUserProvider } from "@/store/auth";
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
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <AuditLogTable />
    </div>
  );
}
