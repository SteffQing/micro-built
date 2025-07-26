"use client";

import { useUserProvider } from "@/store/auth";
import CustomerDetailPage from "@/ui/customer-id";
import { Loader2 } from "lucide-react";
import { use } from "react";

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { userRole, isUserLoading } = useUserProvider();
  return isUserLoading ? (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex items-center gap-2">
        <p>Loading...</p>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      </div>
    </div>
  ) : userRole !== "CUSTOMER" ? (
    <CustomerDetailPage customerId={id} />
  ) : (
    <div>Not applicable to customer</div>
  );
}
