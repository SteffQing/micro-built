import { useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import PageTitle from "@/components/page-title";
import { Icon, icons } from "@/components/icon";
import { myCustomersList } from "@/lib/queries/admin/account-officer";
import { CustomerGroupTable } from "@/ui/account-officers/details/customers-table";

/** The customers a marketer onboarded, as the account officer page shows them. */
export function MarketerCustomersPage() {
  const listQuery = useCallback((params: AccountOfficerCustomersQuery) => myCustomersList(params), []);
  return (
    <main className="@container/main space-y-3 p-3 lg:space-y-5 lg:p-5">
      <PageTitle
        title="Customers"
        actionContent={
          <Button asChild size="sm" className="h-9">
            <Link href="/customers/add-customer">
              <Icon icon={icons.plus} size={16} />
              Add customer
            </Link>
          </Button>
        }
      />
      <CustomerGroupTable
        title="My customers"
        groupKey="me"
        listQuery={listQuery}
        emptyDescription={(status) => `None of your customers has ${status} status`}
      />
    </main>
  );
}
