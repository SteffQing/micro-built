"use client";

import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import PageTitle from "@/components/page-title";
import { AccessDenied } from "@/components/status-screen";
import { useUserProvider } from "@/store/auth";
import { SupportInbox } from "@/ui/support-inbox";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) return <PageSkeleton variant="table" />;
  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return <AccessDenied message="Admins answer support conversations." />;
  }
  return (
    <main className="space-y-3 p-3 lg:space-y-5 lg:p-5">
      <PageTitle title="Support" />
      <Suspense>
        <SupportInbox superAdmin={userRole === "SUPER_ADMIN"} />
      </Suspense>
    </main>
  );
}
