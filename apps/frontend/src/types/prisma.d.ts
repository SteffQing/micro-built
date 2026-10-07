interface Config {
  key: string;
  value: string;
}

interface User {
  id: string;
  image?: string | null;
  externalId?: string | null;
  email: string | null;
  phoneNumber: string | null;
  name: string;
  status: UserStatus;
  role: UserRole;
  type: string;
  twoFactorEnabled: boolean;
  repaymentRate: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UserPayroll {
  userId: string;
  externalId: string;
  employeeGross: number;
  netPay: number;
  grade?: string;
  step?: number;
  command: string;
  /** The organization's name; `organizationId` is its id. */
  organization: string;
  organizationId: string;
}

interface UserIdentity {
  userId: string;
  dateOfBirth: string;
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
  bvn?: string;
  updatedAt: Date;
  createdAt: Date;
}

interface Loan {
  id: string;
  category: LoanCategory;
  status: LoanStatus;
  disbursementDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  borrower: User;
  borrowerId: string;
  repayments: Repayment[];
  asset?: CommodityLoan;
}

interface Repayment {
  id: string;
  amount: number;
  period: string;
  source: PaymentInflowSource;
  state: PaymentInflowState;
  applied: number;
  expected: number | null;
  deductionStatus: DeductionStatus | null;
  createdAt: Date;
  updatedAt: Date;
  loanId: string | null;
}

interface CommodityLoan {
  id: string;
  name: string;
  status: CommodityRequestStatus;
  kind: "NEW_LOAN" | "TOPUP";
  createdAt: Date;
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
  amount: number;
  state: LiquidationStatus;
  hasProof: boolean;
  createdAt: Date;
  approvedAt: Date | null;
}

interface Notification {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  callToActionUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  userId: string | null;
}

interface Topup {
  id: string;
  loanId: string;
  amount: number | null;
  status: LoanStatus;
  requestedAt: string;
  disbursedAt: string | null;
  tenureChange: {
    monthsDelta: number;
    status: TenureChangeStatus;
  } | null;
  asset: { id: string; name: string } | null;
}
