"use client";

import { useUserProvider } from "@/store/auth";
import CustomerDetailPage from "@/ui/customer-id";
import { Icon } from "@/components/icon";
import { icons } from "@/components/icon";
import { use } from "react";

interface Props {
  params: Promise<{ id: string }>;
}

export default function CustomerPage({ params }: Props) {
  const { id } = use(params);
  const { userRole, isUserLoading } = useUserProvider();
  return isUserLoading ? (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex items-center gap-2">
        <p>Loading...</p>
        <Icon icon={icons.loaderCircle} size={16} className="mr-2 animate-spin" />
      </div>
    </div>
  ) : userRole && userRole !== "CUSTOMER" ? (
    <CustomerDetailPage customerId={id} adminRole={userRole} />
  ) : (
    <div>Not applicable to customer</div>
  );
}
