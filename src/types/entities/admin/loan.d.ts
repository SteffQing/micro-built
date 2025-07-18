type CommodityLoan = {
  id: string;
  name: string;
  createdAt: Date;
  inReview: boolean;
  publicDetails?: string;
  privateDetails?: string;
  loanId?: string;
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
  disbursementDate?: Date;
  loanTenure: number;
  extension: number;
  borrowerId: string;
  createdAt: Date;
  updatedAt: Date;
  asset?: CommodityLoan;
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
