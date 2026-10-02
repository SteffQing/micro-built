"use client";
import { useUserProvider } from "@/store/auth";
import { CommoditiesPage } from "@/ui/commodities";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";

export default function Page() {
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) {
    return (
      <div className="w-full h-full items-center flex justify-center">
        <div className="flex items-center flex-col">
          <p>Loading...</p>
          <Icon icon={icons.loaderCircle} size={24} className="text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return (
      <div className="p-6 text-center text-muted-foreground">
        You do not have access to this page.
      </div>
    );
  }

  return <CommoditiesPage />;
}
