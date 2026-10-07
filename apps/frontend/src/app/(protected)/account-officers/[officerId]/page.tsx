"use client";

import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import AccountOfficerDetailsView from "@/ui/account-officers/details";
import { use } from "react";

interface Props {
  params: Promise<{ officerId: string }>;
}

export default function Page({ params }: Props) {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  const { officerId } = use(params);

  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="detail" />
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        <AccountOfficerDetailsView officerId={officerId} />
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
