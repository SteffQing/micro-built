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

type AssetInCashLoanDto = {
  id: string;
  name: string;
};

type BorrowerInCashLoanDto = {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
  externalId: string | null;
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
  createdAt: Date;
  updatedAt: Date;
  asset: AssetInCashLoanDto | null;
  borrower: BorrowerInCashLoanDto;
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

type UserActiveLoan = {
  id: string;
  amount: number;
  repaid: number;
  tenure: number;
  disbursementDate: Date;
};
