"use client";
import { useUserProvider } from "@/store/auth";
import { AdminDashboardPage } from "@/ui/dashboard/admin-dashboard";
import { UserDashboardPage } from "@/ui/dashboard/user-dashboard";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { Suspense } from "react";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <div className="w-full h-full items-center flex justify-center">
          <div className="flex items-center flex-col">
            <p>Loading...</p>
            <Icon icon={icons.loaderCircle} size={24} className="text-primary animate-spin" />
          </div>
        </div>
      ) : !isUserLoading && userRole === "CUSTOMER" ? (
        <UserDashboardPage />
      ) : userRole === "MARKETER" ? (
        <></>
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        // The admin dashboard reads ?variation (notification links), which needs a Suspense boundary.
        <Suspense>
          <AdminDashboardPage role={userRole} />
        </Suspense>
      ) : (
        !isUserLoading && errorUser && <div>An ERROR Occured</div>
      )}
    </>
  );
}
