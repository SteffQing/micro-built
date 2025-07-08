"use client";
import { useUserProvider } from "@/store/auth";
import { AdminCustomersPage } from "@/ui/customers";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {!isUserLoading && userRole === "CUSTOMER" ? (
        <p>Not applicable to customer</p>
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        <AdminCustomersPage />
      ) : !isUserLoading && errorUser ? (
        <div>An ERROR Occured</div>
      ) : (
        <div>UNKNOWN Eror occured contact admin</div>
      )}
    </>
  );
}
