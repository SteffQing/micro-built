interface Config {
  key: string;
  value: string;
}

interface User {
  id: string;
  avatar?: string;
  externalId?: string;
  email: string;
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
  employer: string;
  netPay: number;
  grade: string;
  forceNumber: string;
  step: number;
  command: string;
  user: User;
}

interface UserIdentity {
  userId: string;
  dateOfBirth: string;
  documents: string[];
  gender: Gender;
  maritalStatus: MaritalStatus;
  firstName: string;
  lastName: string;
  contact: string;
  residencyAddress: string;
  stateResidency: string;
  landmarkOrBusStop: string;
  nextOfKinName: string;
  nextOfKinContact: string;
  nextOfKinAddress: string;
  nextOfKinRelationship: Relationship;
  verified: boolean;
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

interface Loan {
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
  period: string;
  periodInDT: Date;
  createdAt: Date;
  status: RepaymentStatus;
  user: User;
  userId: string;
  loan: Loan;
  loanId: string;
}

interface CommodityLoan {
  id: string;
  name: string;
  createdAt: Date;
  inReview: boolean;
  publicDetails?: string;
  privateDetails?: string;
  loan?: Loan;
  loanId?: string;
  userId: string;
  user: User;
}
