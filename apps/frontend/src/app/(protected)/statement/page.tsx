"use client";

import { useUserProvider } from "@/store/auth";
import { CustomerStatementTable } from "@/ui/statement/statement-table";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <div className="w-full h-full items-center flex justify-center">
          <div className="flex items-center flex-col">
            <p>Loading...</p>
            <Icon
              icon={icons.loaderCircle}
              size={24}
              className="text-primary animate-spin"
            />
          </div>
        </div>
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <CustomerStatementTable />
      ) : (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          This page is for customer accounts only.
        </div>
      )}
    </>
  );
}
