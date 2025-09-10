"use client";

import { DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <p className="text-[#666666] text-sm font-normal">{title}</p>
      <p className="text-[#333333] text-sm font-medium">{content}</p>
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
    <ScrollArea className="max-h-[70vh]">
      <div className="grid gap-4 p-4 sm:p-5">
        <Detail title="Repayment Period" content={repayment.period} />
        <Detail
          title="Amount Expected"
          content={formatCurrency(repayment.expectedAmount)}
        />
        <Detail
          title="Amount Repaid"
          content={formatCurrency(repayment.repaidAmount)}
        />
        <Detail title="Repayment Status" content={repayment.status} />
        <Separator className="bg-[#F0F0F0]" />
        {repayment.user ? (
          <>
            <Detail title="Customer ID" content={repayment.user.id} />
            <Detail title="Customer Name" content={repayment.user.name} />
            <Detail
              title="Rate of Repayment"
              content={repayment.user.repaymentRate.toString()}
            />
          </>
        ) : (
          <Detail title="Customer Info" content="Not Found" />
        )}
        {repayment.loanId && isLoading ? (
          <p>Fetching associated loan details...</p>
        ) : data?.data ? (
          <>
            <DialogTitle className="pt-4 pb-2">
              Associated Loan Details
            </DialogTitle>
            <LoanDetailsDisplay
              loan={data.data}
              cName="p-0!"
              scrollable={false}
            />
          </>
        ) : null}
      </div>
    </ScrollArea>
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
    <ScrollArea className="max-h-[70vh]">
      <div className="grid gap-4 p-4 sm:p-5">
        <Detail title="Repayment ID" content={repayment.id} />
        <Detail
          title="Amount Expected"
          content={formatCurrency(repayment.expectedAmount)}
        />
        <Detail
          title="Amount Repaid"
          content={formatCurrency(repayment.repaidAmount)}
        />
        <Detail title="Repayment Period" content={repayment.period} />
        {repayment.penaltyCharge > 0 && (
          <Detail
            title="Penalty Charge"
            content={formatCurrency(repayment.penaltyCharge)}
          />
        )}
        <Detail title="Repayment Status" content={repayment.status} />
        {repayment.loanId && isLoading ? (
          <p>Fetching associated loan details...</p>
        ) : data?.data ? (
          <>
            <DialogTitle className="pt-4 pb-2">
              Associated Loan Details
            </DialogTitle>
            <LoanDetailsDisplay
              loan={data.data}
              cName="p-0!"
              scrollable={false}
            />
          </>
        ) : null}
      </div>
    </ScrollArea>
  );
}
