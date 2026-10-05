"use client";

import { useState } from "react";
import { SectionCardsLoanManagement } from "./section-cards";
import LoanStatusDistribution from "./loan-status-distribution";
import LoanCategoryDistribution from "./loan-category-distribution";
import PageTitle from "@/components/page-title";
import PeriodRangeFilter, { type PeriodRangeValue } from "@/components/period-range-filter";

export default function LoanReportView() {
  const [period, setPeriod] = useState<PeriodRangeValue>({ from: "", to: "" });

  return (
    <div className="@container/main flex min-w-0 flex-col gap-4 bg-muted px-3 py-4 sm:px-4 md:gap-5 md:px-6 md:py-5">
      <PageTitle title="Loan Report" actionContent={<PeriodRangeFilter value={period} onChange={setPeriod} />} />
      <SectionCardsLoanManagement period={period} />
      <div className="grid gap-4 lg:grid-cols-2">
        <LoanStatusDistribution />
        <LoanCategoryDistribution period={period} />
      </div>
    </div>
  );
}
