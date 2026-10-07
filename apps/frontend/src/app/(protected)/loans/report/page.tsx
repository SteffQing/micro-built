"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import LoanReportView from "@/ui/loans/report";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="dashboard" />
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <></>
      ) : (
        <LoanReportView />
      )}
    </>
  );
}
