"use client";
import { useUserProvider } from "@/store/auth";
import { AdminSettingsPage } from "@/ui/settings/admin-settings-view";
import { UserSettingsPage } from "@/ui/settings/user-settings-view";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <div className="w-full h-ful items-center flex justify-center">
          <p>Loading...</p>
        </div>
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <UserSettingsPage />
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        <AdminSettingsPage />
      ) : (
        !isUserLoading && errorUser && <div>An ERROR Occured</div>
      )}
    </>
  );
}
