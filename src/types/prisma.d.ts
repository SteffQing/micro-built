interface Config {
  key: string;
  value: string;
}

interface User {
  id: string;
  avatar?: string;
  externalId?: string;
  email?: string;
  password: string;
  name: string;
  status: UserStatus;
  role: UserRole;
  repaymentRate: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UserPayroll {
  userId: string;
  employeeGross: number;
  netPay: number;
  grade: string;
  step: number;
  command: string;
}

interface UserIdentity {
  userId: string;
  dateOfBirth: string;
  documents: string[];
  gender: Gender;
  maritalStatus: MaritalStatus;

  residencyAddress: string;
  stateResidency: string;
  landmarkOrBusStop: string;

  nextOfKinName: string;
  nextOfKinContact: string;
  nextOfKinAddress: string;
  nextOfKinRelationship: Relationship;

  createdAt: Date;
  updatedAt: Date;
}

interface UserPaymentMethod {
  userId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  updatedAt: Date;
  createdAt: Date;
}

interface ActiveLoan {
  id: string;
  amountRepayable: number;
  amountRepaid: number;
  penaltyAmount: number;
  disbursementDate: Date;
  tenure: number;
  isNew: boolean;
  userId: string;
  user: User;
  createdAt: Date;
  updatedAt: Date;
}

interface Loan {
  id: string;
  amountBorrowed: number;
  amountRepayable: number;
  amountRepaid: number;
  managementFeeRate: number;
  interestRate: number;
  status: LoanStatus;
  category: LoanCategory;
  disbursementDate?: Date;
  tenure: number;
  borrower: User;
  borrowerId: string;
  repayments: Repayment[];
  createdAt: Date;
  updatedAt: Date;
  asset?: CommodityLoan;
}

interface Repayment {
  id: string;
  amount: number;
  expectedAmount: number;
  repaidAmount: number;
  penaltyCharge: number;
  period: string;
  periodInDT: Date;
  createdAt: Date;
  updatedAt: Date;
  status: RepaymentStatus;
  user: User | null;
  userId: string | null;
  loan: Loan | null;
  loanId: string | null;
  liquidationRequestId: string | null;
  liquidationRequest: LiquidationRequest | null;
  failureNote: string | null;
  resolutionNote: string | null;
}

interface CommodityLoan {
  id: string;
  name: string;
  createdAt: Date;
  inReview: boolean;
  publicDetails: string | null;
  privateDetails: string | null;
  loan: Loan | null;
  loanId: string | null;
  userId: string;
  user: User;
}

interface LiquidationRequest {
  id: string;
  customerId: string;
  totalAmount: number;
  status: LiquidationStatus;
  createdAt: Date;
  approvedAt: Date | null;
  adminId: string;
}

interface Notification {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  callToActionUrl: string | null;
  userId: string | null;
  isRead: boolean;
}
