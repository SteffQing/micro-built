"use client";

import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { useUserProvider } from "@/store/auth";
import { VariationsPage } from "@/ui/variations/variations-page";

export default function Page() {
  const { isUserLoading } = useUserProvider();

  if (isUserLoading) {
    return (
      <PageSkeleton variant="table" />
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
