type BorrowerInLoanDto = {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
  externalId: string | null;
};

type BorrowerCustomerInLoansDto = {
  id: string;
  name: string;
  externalId: string | null;
};

type CommodityLoanDto = {
  id: string;
  name: string;
  inReview: boolean;
  publicDetails: string | null;
  privateDetails: string | null;
  loanId: string | null;
  borrower: BorrowerInLoanDto;
  createdAt: Date;
};

type AssetInCashLoanDto = {
  id: string;
  name: string;
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
  borrower: BorrowerInLoanDto;
};

type CashLoanItemDto = {
  id: string;
  date: Date;
  amount: number;
  customer: BorrowerCustomerInLoansDto;
  category: LoanCategory;
  loanTenure: number;
  status: LoanStatus;
};

type CommodityLoanItemDto = {
  id: string;
  date: Date;
  customer: BorrowerCustomerInLoansDto;
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
