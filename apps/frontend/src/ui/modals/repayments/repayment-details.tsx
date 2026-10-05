"use client";

import { DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { userCashLoanQuery } from "@/lib/queries/user/loan";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { LoanDetailsDisplay } from "../loan-details";
import { cashLoanQuery } from "@/lib/queries/admin/cash-loans";

interface RepaymentDetailsDisplayProps {
  repayment: SingleRepaymentWithUserDto | SingleUserRepaymentDto;
}
export default function RepaymentDetailsDisplay({
  repayment,
}: RepaymentDetailsDisplayProps) {
  if ("user" in repayment) {
    return (
      <AdminRepaymentDetailsDisplay
        repayment={repayment as SingleRepaymentWithUserDto}
      />
    );
  }
  return (
    <UserRepaymentDetailsDisplay
      repayment={repayment as SingleUserRepaymentDto}
    />
  );
}

interface Props {
  title: string;
  content: string;
}
function Detail({ title, content }: Props) {
  return (
    <div className="flex justify-between items-center gap-4">
      <p className="text-foreground text-sm font-normal">{title}</p>
      <p className="text-foreground text-sm font-medium min-w-0 break-words text-right">{content}</p>
    </div>
  );
}

interface AdminRepaymentDetailsDisplayProps
  extends RepaymentDetailsDisplayProps {
  repayment: SingleRepaymentWithUserDto;
}
function AdminRepaymentDetailsDisplay({
  repayment,
}: AdminRepaymentDetailsDisplayProps) {
  const { data, isLoading } = useQuery({
    ...cashLoanQuery(repayment.loanId!),
    enabled: Boolean(repayment.loanId),
  });

  return (
    <div className="min-w-0">
      <div className="grid gap-4 p-4 sm:p-5">
        <Detail title="Repayment Period" content={repayment.period} />
        {repayment.state === "REVIEWING" && (
          <Detail
            title="Amount to Resolve"
            content={formatCurrency(repayment.amount)}
          />
        )}
        <Detail
          title="Amount Received"
          content={formatCurrency(repayment.amount)}
        />
        <Detail
          title="Amount Applied"
          content={formatCurrency(repayment.applied)}
        />
        <Detail title="Payment State" content={repayment.state} />
        {repayment.deduction && (
          <Detail
            title="Expected Deduction"
            content={formatCurrency(repayment.deduction.expected)}
          />
        )}
        {repayment.history && repayment.history.length > 0 && (
          <>
            <Separator className="bg-border" />
            <p className="text-xs font-medium text-muted-foreground">History</p>
            {repayment.history.map((entry, i) => (
              <div key={i} className="text-sm">
                <span className="text-muted-foreground">{entry.action}</span>
                {entry.note && <span> — {entry.note}</span>}
              </div>
            ))}
          </>
        )}
        <Separator className="bg-border" />
        {repayment.loanId && isLoading ? (
          <p className="text-sm text-muted-foreground">Fetching associated loan details...</p>
        ) : data?.data ? (
          <>
            <DialogTitle className="pt-4 pb-2">
              Associated Loan Details
            </DialogTitle>
            <LoanDetailsDisplay
              loan={data.data}
              cName="p-0!"
             
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function UserRepaymentDetailsDisplay({
  repayment,
}: {
  repayment: SingleUserRepaymentDto;
}) {
  const { data, isLoading } = useQuery({
    ...userCashLoanQuery(repayment.loanId!),
    enabled: Boolean(repayment.loanId),
  });
  return (
    <div className="min-w-0">
      <div className="grid gap-4 p-4 sm:p-5">
        <Detail title="Repayment ID" content={repayment.id} />
        <Detail
          title="Amount Expected"
          content={formatCurrency(repayment.expected ?? 0)}
        />
        <Detail
          title="Amount Paid"
          content={formatCurrency(repayment.amount)}
        />
        <Detail title="Repayment Period" content={repayment.period} />
        <Detail title="Payment Source" content={repayment.source} />
        <Detail title="Repayment Status" content={repayment.deductionStatus ?? "—"} />
        {repayment.loanId && isLoading ? (
          <p className="text-sm text-muted-foreground">Fetching associated loan details...</p>
        ) : data?.data ? (
          <>
            <DialogTitle className="pt-4 pb-2">
              Associated Loan Details
            </DialogTitle>
            <LoanDetailsDisplay
              loan={data.data}
              cName="p-0!"
             
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
