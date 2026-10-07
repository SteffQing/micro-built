"use client";

import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import OrganizationDetailsView from "@/ui/organizations/details";
import { use } from "react";

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
        <div className="flex flex-col items-center justify-center h-full gap-4">
          {!isUserLoading && errorUser ? (
            <div>An ERROR Occurred</div>
          ) : (
            <p>You do not have permission to view this page.</p>
          )}
        </div>
      )}
    </>
  );
}
