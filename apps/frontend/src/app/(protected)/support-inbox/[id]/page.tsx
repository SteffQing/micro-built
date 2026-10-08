"use client";

import Link from "next/link";
import { use } from "react";
import { Icon, icons } from "@/components/icon";
import { PageSkeleton } from "@/components/page-skeleton";
import { AccessDenied } from "@/components/status-screen";
import { useUserProvider } from "@/store/auth";
import { SupportThreadView } from "@/ui/support-inbox/thread";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { userRole, isUserLoading } = useUserProvider();

  if (isUserLoading) return <PageSkeleton variant="detail" />;
  if (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return <AccessDenied message="Admins answer support conversations." />;
  }
  return (
    <main className="space-y-3 p-3 lg:space-y-5 lg:p-5">
      <Link href="/support-inbox" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Icon icon={icons.arrowLeft} size={14} /> Support inbox
      </Link>
      <SupportThreadView id={id} />
    </main>
  );
}
