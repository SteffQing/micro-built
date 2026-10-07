"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import AdminSettingsPage from "@/ui/settings/admin-settings-view";
import { UserSettingsPage } from "@/ui/settings/user-settings-view";
import { AccountLoadError } from "@/components/status-screen";

export default function Page() {
  const { userRole, isUserLoading, errorUser} = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="form" />
      ) : !isUserLoading &&
        (userRole === "CUSTOMER" ||
          userRole === "ADMIN" ||
          
          userRole === "MARKETER") ? (
        <UserSettingsPage />
      ) : userRole === "SUPER_ADMIN" ? (
        <AdminSettingsPage />
      ) : (
        errorUser && <AccountLoadError />
      )}
    </>
  );
}
