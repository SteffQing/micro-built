"use client";

import { useUserProvider } from "@/store/auth";
import { PageSkeleton } from "@/components/page-skeleton";
import CustomerDetailPage from "@/ui/customer-id";
import { use } from "react";

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
    <div>Not applicable to customer</div>
  );
}
