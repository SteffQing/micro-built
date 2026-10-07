"use client";

import { Suspense } from "react";
import { Icon, icons } from "@/components/icon";
import { useUserProvider } from "@/store/auth";
import { VariationsPage } from "@/ui/variations/variations-page";

export default function Page() {
  const { isUserLoading } = useUserProvider();

  if (isUserLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Icon icon={icons.loaderCircle} size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // The page keeps the organization and month in ?organizationId and ?period (links from notifications and the
  // dashboard), which needs a Suspense boundary.
  return (
    <Suspense>
      <VariationsPage />
    </Suspense>
  );
}
