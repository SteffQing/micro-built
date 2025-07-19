"use client";
import { useUserProvider } from "@/store/auth";
import CashLoansTable from "@/ui/loans/cash";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();
  return (
    <>
      <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
        {!isUserLoading && userRole === "CUSTOMER" ? <></> : <CashLoansTable />}
      </div>
    </>
  );
}
