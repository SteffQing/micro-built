"use client";
import { useUserProvider } from "@/store/auth";
import CashLoansTable from "@/ui/loans/cash";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();
  return (
    <>
      {!isUserLoading && userRole === "CUSTOMER" ? <></> : <CashLoansTable />}
    </>
  );
}
