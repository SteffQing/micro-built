import { AdminCustomerSectionCards } from "./section-card";
import CustomersListTable from "./table-customers-lists";
import PageTitle from "@/components/page-title";
import UploadNewCustomer from "../modals/upload-customer";

export function AdminCustomersPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <PageTitle title="Customers" actionContent={<UploadNewCustomer />} />
      <AdminCustomerSectionCards />
      <CustomersListTable />
    </div>
  );
}
