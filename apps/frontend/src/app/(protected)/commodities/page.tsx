"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { CommoditiesPage } from "@/ui/commodities";
import { AccessDenied } from "@/components/status-screen";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) {
    return (
      <PageSkeleton variant="table" />
    );
  }

  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return <AccessDenied message="The commodity catalogue is managed by admins and super admins." />;
  }

  return <CommoditiesPage />;
}
