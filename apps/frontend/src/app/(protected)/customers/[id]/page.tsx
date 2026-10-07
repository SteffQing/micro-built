"use client";

import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import CustomerDetailPage from "@/ui/customer-id";
import { use } from "react";
import { AccessDenied } from "@/components/status-screen";

interface Props {
  params: Promise<{ id: string }>;
}

export default function CustomerPage({ params }: Props) {
  const { id } = use(params);
  const { userRole, isUserLoading } = useUserProvider();
  return isUserLoading ? (
    <PageSkeleton variant="detail" />
  ) : userRole && userRole !== "CUSTOMER" ? (
    <CustomerDetailPage customerId={id} adminRole={userRole} />
  ) : (
    <AccessDenied message="Customer records are for MicroBuilt staff. Your own details are in Settings." />
  );
}
