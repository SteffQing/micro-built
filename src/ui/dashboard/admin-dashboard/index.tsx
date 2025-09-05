import { SectionCardsAdminDashboad } from "./section-cards";
import LoanDisbursementChart from "./chart-area-intective";
import LoanRequestTableAdminDashboard from "./loan-request-table";
import CustomerStatsCard from "./customer-stats-card";
import PageTitle from "@/components/page-title";
import { RequestRepaymentSchedule } from "./repayment-schedule";

export function AdminDashboardPage() {
	return (
		<div className="@container/main flex flex-col gap-4 py-4 px-4 md:gap-6 md:py-6">
			<PageTitle
				title="Dashboard"
				actionContent={<RequestRepaymentSchedule  />}
			/>
			<SectionCardsAdminDashboad />

			<div className="grid gap-4 grid-cols-1 md:grid-cols-3 lg:grid-cols-7">
				<div className="space-y-4 md:col-span-2 lg:col-span-5">
					<LoanDisbursementChart />
				</div>

				<div className="space-y-4 md:col-span-1 lg:col-span-2">
					<CustomerStatsCard />
				</div>
			</div>

			<div className="mt-4">
				<LoanRequestTableAdminDashboard />
			</div>
		</div>
	);
}
