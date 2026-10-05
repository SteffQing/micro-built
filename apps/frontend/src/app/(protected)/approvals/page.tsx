"use client";

import { Icon, icons } from "@/components/icon";
import { useUserProvider } from "@/store/auth";
import { Suspense } from "react";
import ChangeRequestsTable from "@/ui/change-requests/change-requests-table";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Icon icon={icons.loaderCircle} size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return <div className="p-6 text-center text-muted-foreground">You do not have access to this page.</div>;
  }

  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      {/* The table reads ?request (notification links), which needs a Suspense boundary. */}
      <Suspense>
        <ChangeRequestsTable />
      </Suspense>
    </div>
  );
}
