import { useQuery } from "@tanstack/react-query";
import { icons, type IconData } from "@/components/icon";
import { IconTile } from "@/components/icon-tile";
import ReportCard from "@/components/report-card";
import { accountOfficerStats } from "@/lib/queries/admin/account-officer";
import { formatCurrency } from "@/lib/utils";

interface Props {
  officerId: string;
}

type Tone = "brand" | "success" | "warning" | "danger" | "neutral";
interface Metric {
  title: string;
  icon: IconData;
  tone: Tone;
  value: (stats?: AccountOfficerStatsDto | null) => string;
}

const metrics: Metric[] = [
  {
    title: "Total customers",
    icon: icons.userGroup,
    tone: "brand",
    value: (s) => (s?.customers?.total ?? 0).toLocaleString(),
  },
  {
    title: "Active customers",
    icon: icons.checkCircle,
    tone: "success",
    value: (s) => (s?.customers?.active ?? 0).toLocaleString(),
  },
  {
    title: "Inactive customers",
    icon: icons.user,
    tone: "neutral",
    value: (s) => (s?.customers?.inactive ?? 0).toLocaleString(),
  },
  {
    title: "Suspended customers",
    icon: icons.shieldAlert,
    tone: "warning",
    value: (s) => (s?.customers?.flagged ?? 0).toLocaleString(),
  },
  {
    title: "Avg. repayment score",
    icon: icons.percent,
    tone: "brand",
    value: (s) => `${s?.customers?.avgRepaymentScore ?? 0}%`,
  },
  {
    title: "Total loans",
    icon: icons.loans,
    tone: "brand",
    value: (s) => (s?.portfolio?.totalLoans ?? 0).toLocaleString(),
  },
  {
    title: "Total disbursed",
    icon: icons.wallet,
    tone: "neutral",
    value: (s) => formatCurrency(s?.portfolio?.totalDisbursed ?? 0),
  },
  {
    title: "Total repaid",
    icon: icons.moneyReceive,
    tone: "success",
    value: (s) => formatCurrency(s?.portfolio?.totalRepaid ?? 0),
  },
  {
    title: "Outstanding balance",
    icon: icons.alertTriangle,
    tone: "danger",
    value: (s) => formatCurrency(s?.portfolio?.outstandingBalance ?? 0),
  },
  {
    title: "Total penalty",
    icon: icons.dollarSign,
    tone: "danger",
    value: (s) => formatCurrency(s?.portfolio?.totalPenalty ?? 0),
  },
];

export const AccountOfficerStatsCards = ({ officerId }: Props) => {
  const { data, isLoading } = useQuery(accountOfficerStats(officerId));
  const stats = data?.data;

  return (
    <section
      aria-label="Officer metrics"
      aria-busy={isLoading}
      className="grid w-full grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
    >
      {metrics.map(({ title, icon, tone, value }) => (
        <ReportCard
          key={title}
          title={title}
          value={value(stats)}
          icon={<IconTile icon={icon} tone={tone} />}
          className="rounded-xl"
          loading={isLoading}
        />
      ))}
    </section>
  );
};
