"use client";
import { useUserProvider } from "@/store/auth";
import { OrganizationsPage } from "@/ui/organizations";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";

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
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        <OrganizationsPage />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          {!isUserLoading && errorUser ? (
            <div>An ERROR Occurred</div>
          ) : (
            <p>You do not have permission to view this page.</p>
          )}
        </div>
      )}
    </>
  );
}
