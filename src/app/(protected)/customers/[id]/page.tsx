import { useUserProvider } from "@/store/auth";
import CustomerDetailPage from "@/ui/customer-id";
// import { AdminCustomersPage } from "@/ui/customers";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // const { userRole, isUserLoading, errorUser } = useUserProvider();
  const { id: customerId } = await params;
  console.log({ customerId });
  return (
    <>
      <CustomerDetailPage customerId={customerId} />
      {/* {!isUserLoading && userRole === "CUSTOMER" ? (
        <p>Not applicable to customer</p>
      ) : userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? (
        // <AdminCustomersPage />
        <></>
      ) : !isUserLoading && errorUser ? (
        <div>An ERROR Occured</div>
      ) : (
        <div>UNKNOWN Eror occured contact admin</div>
      )} */}
    </>
  );
}
