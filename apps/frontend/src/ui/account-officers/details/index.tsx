import { AccountOfficerStatsCards } from "./stats-cards";
import AccountOfficerCustomersTable from "./customers-table";
import PageTitle from "@/components/page-title";
import { accountOfficers } from "@/lib/queries/admin/account-officer";
import { useQuery } from "@tanstack/react-query";

interface Props {
  officerId: string;
}

const SYSTEM = "microbuilt-system-id";

export default function AccountOfficerDetailsView({ officerId }: Props) {
  const isSystem = officerId === SYSTEM;
  // Officers are admins, not customers: their name comes from the account-officer list (already cached by the
  // list page), which also carries the platform's own "Self-Signed" entry.
  const { data, isLoading } = useQuery(accountOfficers);
  const officer = data?.data?.find((o) => o.id === officerId);
  const name = isSystem ? "Platform (Self-Signed)" : (officer?.name ?? (isLoading ? "…" : "Unknown officer"));

  return (
    <div className="@container/main flex flex-col gap-6 py-6 px-4 md:px-8 max-w-7xl mx-auto w-full">
      <PageTitle
        title={`${name} · Account Officer`}
      />

      <AccountOfficerStatsCards officerId={officerId} />

      <AccountOfficerCustomersTable officerId={officerId} />
    </div>
  );
}
