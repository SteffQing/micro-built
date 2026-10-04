"use client";

import { useUserProvider } from "@/store/auth";
import AccountOfficerDetailsView from "@/ui/account-officers/details";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
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
        <div className="w-full h-full items-center flex justify-center">
          <div className="flex items-center flex-col">
            <p>Loading...</p>
            <Icon icon={icons.loaderCircle} size={24} className="text-primary animate-spin" />
          </div>
        </div>
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
