"use client";

import { useEffect } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { useRouter } from "next/navigation";
import { useUserProvider } from "@/store/auth";
import { MarketerLoansPage } from "@/ui/marketer/loans-page";

// A marketer's loans live here; admins have a page per kind, starting with the report.
export default function LoansPage() {
  const { userRole, isUserLoading } = useUserProvider();
  const router = useRouter();
  const marketer = userRole === "MARKETER";

  useEffect(() => {
    if (!isUserLoading && userRole && !marketer) router.replace("/loans/report");
  }, [isUserLoading, userRole, marketer, router]);

  if (marketer) return <MarketerLoansPage />;
  return (
    <PageSkeleton variant="table" />
  );
}
