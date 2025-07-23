export const LoanDetails = ({ loan }: { loan: CashLoanItemDto }) => {
  return (
    <div className="flex flex-col gap-2 bg-accent/70 p-4 rounded-lg">
      <div className="flex gap-2 justify-between">
        <p className="text-sm text-muted-foreground">Loan Type</p>
        <p>: {loan.category}</p>
      </div>
      <div className="flex gap-2 justify-between">
        <p className="text-sm text-muted-foreground">Customer Id</p>
        <p>: {loan.customerId}</p>
      </div>
      <div className="flex gap-2 justify-between">
        <p className="text-sm text-muted-foreground">Loan Amount</p>
        <p>: {loan.amount}</p>
      </div>
      <div className="flex gap-2 justify-between">
        <p className="text-sm text-muted-foreground">Interest Rate</p>
        <p>...</p>
      </div>
    </div>
  );
};
