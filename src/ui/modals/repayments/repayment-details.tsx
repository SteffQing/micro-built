"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "date-fns";

interface RepaymentDetailsDisplayProps {
  repayment: RepaymentsHistoryDto | UserRepaymentHistoryDto;
}

export default function RepaymentDetailsDisplay({ repayment }: RepaymentDetailsDisplayProps) {
  if ("userId" in repayment) return <AdminRepaymentDetailsDisplay repayment={repayment as RepaymentsHistoryDto} />;
  return <UserRepaymentDetailsDisplay repayment={repayment as UserRepaymentHistoryDto} />;
}

interface AdminRepaymentDetailsDisplayProps extends RepaymentDetailsDisplayProps {
  repayment: RepaymentsHistoryDto;
}
interface Props {
  title: string;
  content: string;
}
function Detail({ title, content }: Props) {
  return (
    <div className="flex justify-between items-center gap-4">
      <p className="text-[#666666] text-sm font-normal">{title}</p>
      <p className="text-[#333333] text-sm font-medium">{content}</p>
    </div>
  );
}

function AdminRepaymentDetailsDisplay({ repayment }: AdminRepaymentDetailsDisplayProps) {
  return (
    <ScrollArea className="max-h-[70vh]">
      <div className="grid gap-4 p-4 sm:p-5">
        <Detail title="Customer ID" content={repayment.userId} />
        <Detail title="Repayment Period" content={repayment.period} />
        <Detail title="Amount Expected" content={formatCurrency(repayment.expectedAmount)} />
        <Detail title="Amount Repaid" content={formatCurrency(repayment.repaidAmount)} />
        <Detail title="Repayment Status" content={repayment.status} />

        <Separator className="bg-[#F0F0F0]" />
      </div>
    </ScrollArea>
  );
}

function UserRepaymentDetailsDisplay({ repayment }: { repayment: UserRepaymentHistoryDto }) {
  return (
    <ScrollArea className="max-h-[70vh]">
      <div className="grid gap-4 p-4 sm:p-5">
        <Detail title="Repayment ID" content={repayment.id} />
        <Detail title="Amount Repaid" content={formatCurrency(repayment.repaid)} />
        <Detail title="Repayment Period" content={repayment.period} />
        <Detail title="Repayment Date" content={formatDate(repayment.date, "PPP")} />
        {/* <Detail title="Amount Repaid" content={formatCurrency(repayment.amountRepaid)} /> Should show loanId linkage */}
        <Separator className="bg-[#F0F0F0]" />
      </div>
    </ScrollArea>
  );
}
