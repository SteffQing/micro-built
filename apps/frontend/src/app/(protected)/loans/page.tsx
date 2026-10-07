"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon, icons } from "@/components/icon";
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
    <div className="flex h-full w-full items-center justify-center">
      <Icon icon={icons.loaderCircle} size={24} className="animate-spin text-primary" />
    </div>
  );
}
