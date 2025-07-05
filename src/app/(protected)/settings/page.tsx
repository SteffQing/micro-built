"use client";
import { useUserProvider } from "@/store/auth";
import { UserSettingsPage } from "@/ui/settings/user-settings-view";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {!isUserLoading && userRole === "CUSTOMER" ? (
        <UserSettingsPage />
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
