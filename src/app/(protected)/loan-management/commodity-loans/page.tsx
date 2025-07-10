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
        <div className="flex items-center justify-center h-full">
          <p>Coming soon</p>
        </div>
      )}
    </>
  );
}
