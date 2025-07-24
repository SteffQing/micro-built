type UserCashLoan = {
  repayable: number;
  amount: number;
  assetName: string | undefined;
  assetId: string | undefined;
  id: string;
  status: LoanStatus;
  category: LoanCategory;
  disbursementDate: Date | null;
  loanTenure: number;
  extension: number;
  createdAt: Date;
  updatedAt: Date;
};
