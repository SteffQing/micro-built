"use client";

import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import AccountOfficerDetailsView from "@/ui/account-officers/details";
import { use } from "react";
import { AccessDenied, AccountLoadError } from "@/components/status-screen";

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
        errorUser ? (
          <AccountLoadError />
        ) : (
          <AccessDenied message="It's for MicroBuilt staff. If you think you should have access, ask a super admin." />
        )
      )}
    </>
  );
}
