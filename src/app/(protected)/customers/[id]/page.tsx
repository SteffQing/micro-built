import CustomerDetailPage from "@/ui/customer-id";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: customerId } = await params;
  console.log({ customerId });
  return (
    <>
      <CustomerDetailPage customerId={customerId} />
    </>
  );
}
