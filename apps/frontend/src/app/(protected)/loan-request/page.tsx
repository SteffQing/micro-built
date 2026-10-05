"use client";
import { useUserProvider } from "@/store/auth";
import { UserLoanRequestPage } from "@/ui/loan-request";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
        <div className="w-full h-full items-center flex justify-center">
          <div className="flex items-center flex-col">
            <p>Loading...</p>
            <Icon icon={icons.loaderCircle} size={24} className="text-primary animate-spin" />
          </div>
        </div>
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <UserLoanRequestPage />
      ) : userRole ? (
        <StaffRedirect />
      ) : (
        !isUserLoading && errorUser && <div>An ERROR Occured</div>
      )}
    </>
  );
}
