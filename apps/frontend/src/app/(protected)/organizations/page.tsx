"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { OrganizationsPage } from "@/ui/organizations";
import { AccessDenied, AccountLoadError } from "@/components/status-screen";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="table" />
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        <OrganizationsPage />
      ) : (
        errorUser ? (
          <AccountLoadError />
        ) : (
          <AccessDenied message="It's for MicroBuilt staff. If you think you should have access, ask a super admin." />
        )
      )}
    </>
  );
}
