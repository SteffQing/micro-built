"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { CommoditiesPage } from "@/ui/commodities";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) {
    return (
      <PageSkeleton variant="table" />
    );
  }

  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return (
      <div className="p-6 text-center text-muted-foreground">
        You do not have access to this page.
      </div>
    );
  }

  return <CommoditiesPage />;
}
