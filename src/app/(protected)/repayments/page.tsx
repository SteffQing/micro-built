"use client";
import { useUserProvider } from "@/store/auth";
import { UserRepaymentsPage } from "@/ui/repyments/user-repayments-view";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {!isUserLoading && userRole === "CUSTOMER" ? (
        <UserRepaymentsPage />
      ) : userRole === "ADMIN" ? (
        <div>No admin page for loarequest</div>
      ) : !isUserLoading && errorUser ? (
        <div>An ERROR Occured</div>
      ) : (
        <div>UNKNOWN Eror occured contact admin</div>
      )}
    </>
  );
}
