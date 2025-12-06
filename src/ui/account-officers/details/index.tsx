import { AccountOfficerStatsCards } from "./stats-cards";
import AccountOfficerCustomersTable from "./customers-table";
import PageTitle from "@/components/page-title";
import { customerQuery } from "@/lib/queries/admin/customer";
import { useQuery } from "@tanstack/react-query";

interface Props {
  officerId: string;
}

const SYSTEM = "microbuilt-system-id";

export default function AccountOfficerDetailsView({ officerId }: Props) {
  const isSystem = officerId === SYSTEM;
  const { data } = useQuery({
    ...customerQuery(officerId),
    enabled: !isSystem,
  });

  return (
    <div className="@container/main flex flex-col gap-6 py-6 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <PageTitle
        title={`${isSystem ? "System" : data?.data?.name} - Account Officer`}
      />

      <AccountOfficerStatsCards officerId={officerId} />

      <AccountOfficerCustomersTable officerId={officerId} />
    </div>
  );
}
