"use client";
import { useUserProvider } from "@/store/auth";
import CommodityLoansTable from "@/ui/loans/commodity";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();
  return (
    <>
      {!isUserLoading && userRole === "CUSTOMER" ? (
        <></>
      ) : (
        <CommodityLoansTable />
      )}
    </>
  );
}
