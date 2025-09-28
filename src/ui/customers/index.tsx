import { Button } from "@/components/ui/button";
import { AdminCustomerSectionCards } from "./section-card";
import CustomersListTable from "./table-customers-lists";
import PageTitle from "@/components/page-title";
import Link from "next/link";

export function AdminCustomersPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <PageTitle
        title="Customers"
        actionContent={
          <Link href="/customers/add-customer">
            <Button size="sm">Add Customer</Button>
          </Link>
        }
      />
      <AdminCustomerSectionCards />
      <CustomersListTable />
    </div>
  );
}
