import { Button } from "@/components/ui/button";
import CustomersListTable from "./table-customers-lists";
import PageTitle from "@/components/page-title";
import Link from "next/link";
import { Icon, icons } from "@/components/icon";

export function MarketerCustomersPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <PageTitle
        title="Customers"
        titleAside={
          <Button asChild size="sm">
            <Link href="/customers/add-customer">
              <Icon icon={icons.plus} size={16} />
              Add Customer
            </Link>
          </Button>
        }
      />
      <CustomersListTable />
    </div>
  );
}
