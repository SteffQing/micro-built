type CommodityLoan = {
  id: string;
  name: string;
  createdAt: Date;
  inReview: boolean;
  publicDetails: string | null;
  privateDetails: string | null;
  loanId: string | null;
  userId: string;
};

type CashLoan = {
  id: string;
  amount: number;
  amountRepayable: number;
  amountRepaid: number;
  managementFeeRate: number;
  interestRate: number;
  status: LoanStatus;
  category: LoanCategory;
  disbursementDate: Date | null;
  tenure: number;
  borrowerId: string;
  createdAt: Date;
  updatedAt: Date;
  asset: CommodityLoan | null;
};

type CashLoanItemDto = {
  id: string;
  date: Date;
  amount: number;
  customerId: string;
  category: LoanCategory;
  loanTenure: number;
  status: LoanStatus;
};

type CommodityLoanItemDto = {
  id: string;
  date: Date;
  customerId: string;
  name: string;
  inReview: boolean;
  loanId: string | null;
};
