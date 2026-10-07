"use client";

import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import OrganizationDetailsView from "@/ui/organizations/details";
import { use } from "react";
import { AccessDenied, AccountLoadError } from "@/components/status-screen";

interface Props {
  params: Promise<{ organizationId: string }>;
}

export default function Page({ params }: Props) {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  const { organizationId } = use(params);

  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="detail" />
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        <OrganizationDetailsView organizationId={organizationId} />
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
