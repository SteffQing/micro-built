"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { UserLoanRequestPage } from "@/ui/loan-request";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AccountLoadError } from "@/components/status-screen";

// Loan requests are a customer page; staff review requests under Loans.
function StaffRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/loans/cash");
  }, [router]);
  return null;
}

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="form" />
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <UserLoanRequestPage />
      ) : userRole ? (
        <StaffRedirect />
      ) : (
        errorUser && <AccountLoadError />
      )}
    </>
  );
}
