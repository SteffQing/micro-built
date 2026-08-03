type CustomerInfoDto = {
  id: string;
  name: string;
  email: string | null;
  status: UserStatus;
  flagReason: string | null;
  contact: string | null;
  avatar: string | null;
  repaymentRate: number;
};

type ActiveLoanDto = {
  id: string;
  amount: number;
  tenure: number;
  amountRepaid: number;
  amountOwed: number;
  category: LoanCategory;
  type: "New" | "Topup";
  status: LoanStatus;
  asset: { id: string; name: string } | null;
};

type PendingLoanDto = {
  id: string;
  detailsId: string;
  recordType: "LOAN" | "COMMODITY_REQUEST";
  category: LoanCategory;
  amount: number | null;
  date: Date;
  status: LoanStatus;
  type: "New" | "Topup";
  tenure: number | null;
  asset: { id: string; name: string } | null;
};

type UserLoansDto = {
  activeLoans: ActiveLoanDto[];
  pendingLoans: PendingLoanDto[];
  approvedLoans: PendingLoanDto[];
  applications: PendingLoanDto[];
};

type UserLoanSummaryDto = {
  totalBorrowed: number;
  totalRepaid: number;
  totalPenalties: number;
  currentOverdue: number;
  totalLoanAmount: number;
  totalDisbursed: number;
  managementFee: number;
  interestEarned: number;
  interestReceived: number;
  penaltiesReceived: number;
  outstanding: number;
  activeLoansCount: number;
  pendingLoansCount: number;
  lastRepaymentDate: string | null;
  lastRepaymentPeriod: string | null;
};

type CustomerListItemDto = {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
  status: UserStatus;
  repaymentRate: number;
};

type CustomersOverviewDto = {
  activeCustomersCount: number;
  flaggedCustomersCount: number;
  customersWithActiveLoansCount: number;
  defaultedCount: number;
  flaggedCount: number;
  ontimeCount: number;
};

type CustomerPPI = {
  payroll: UserPayroll | null;
  identity: UserIdentity | null;
  paymentMethod: UserPaymentMethod | null;
};

type CustomerUserId = {
  userId: string;
};
