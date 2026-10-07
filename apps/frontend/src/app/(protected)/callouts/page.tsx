"use client";

import { PageSkeleton } from "@/components/page-skeleton";
import { useUserProvider } from "@/store/auth";
import { CalloutsPage } from "@/ui/callouts";
import { AccessDenied } from "@/components/status-screen";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) return <PageSkeleton variant="list" />;
  if (userRole !== "SUPER_ADMIN") {
    return <AccessDenied message="Only super admins manage callouts." />;
  }
  return <CalloutsPage />;
}
