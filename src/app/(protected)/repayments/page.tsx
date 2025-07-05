"use client";
import { useUserProvider } from "@/store/auth";
// import { UserLoanRequestPage } from "@/ui/loan-request";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {/* {!isUserLoading && userRole === "CUSTOMER" ? (
        <UserLoanRequestPage />
      ) : userRole === "ADMIN" ? (
        <div>No admin page for loarequest</div>
      ) : !isUserLoading && errorUser ? (
        <div>An ERROR Occured</div>
      ) : (
        <div>UNKNOWN Eror occured contact admin</div>
      )} */}
    </>
  );
}
