import CustomerDetailPage from "@/ui/customer-id";
import { use } from "react";

export default function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <>
      <CustomerDetailPage customerId={id} />
    </>
  );
}
