"use client";
import { useUserProvider } from "@/store/auth";
import LoanReportView from "@/ui/loans/report";
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
            <Icon icon={icons.loaderCircle} size={24} className="text-primary animate-spin" />
          </div>
        </div>
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <></>
      ) : (
        <LoanReportView />
      )}
    </>
  );
}
