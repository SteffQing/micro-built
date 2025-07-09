"use client";
import { useUserProvider } from "@/store/auth";
import { AdminLoanManagementPage } from "@/ui/loan-management";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {!isUserLoading && userRole === "CUSTOMER" ? (
        <></>
      ) : (
        <AdminLoanManagementPage />
      )}
    </>
  );
}
