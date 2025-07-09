import { SiteSubHeader } from "@/components/site-sub-header";
import { AdminCustomerSectionCards } from "./section-card";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import CustomersListTable from "./customers-lists-table";

export function AdminCustomersPage() {
  return (
    <div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
      <SiteSubHeader
        breadcrumbs={[{ label: "Customers", isCurrentPage: true }]}
        rightContent={<HeaderRightContent />}
      />
      <AdminCustomerSectionCards />
      <CustomersListTable />
    </div>
  );
}

const HeaderRightContent = () => {
  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary">
        Quick Action <ChevronDown className="w-3 h-3" />
      </Button>
    </div>
  );
};
