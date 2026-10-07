"use client";
import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import { OrganizationsPage } from "@/ui/organizations";

export default function Page() {
  const { userRole, isUserLoading, errorUser } = useUserProvider();
  return (
    <>
      {isUserLoading ? (
        <PageSkeleton variant="table" />
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
