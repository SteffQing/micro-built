import {
  Loan,
  Repayment,
  User,
  UserIdentity,
  UserPaymentMethod,
} from '@prisma/client';

type ActivitySource =
  | 'User'
  | 'UserIdentity'
  | 'UserPaymentMethod'
  | 'Loan'
  | 'Repayment';

interface ActivitySummary {
  title: string;
  description: string;
  date: Date;
  source: ActivitySource;
}

type UserActivity = Pick<User, 'createdAt' | 'updatedAt'>;
type UserIdentityActivity = Pick<
  UserIdentity,
  'createdAt' | 'updatedAt' | 'verified'
>;
type UserPaymentMethodActivity = Pick<
  UserPaymentMethod,
  'createdAt' | 'updatedAt' | 'bankName'
>;
type LoanActivity = Pick<
  Loan,
  | 'createdAt'
  | 'updatedAt'
  | 'amount'
  | 'disbursementDate'
  | 'extension'
  | 'repayable'
  | 'status'
>;
type RepaymentActivity = Pick<Repayment, 'createdAt' | 'repaid' | 'loanId'>;

type Activities =
  | UserActivity
  | UserIdentityActivity
  | UserPaymentMethodActivity
  | LoanActivity
  | RepaymentActivity;

export {
  ActivitySource,
  ActivitySummary,
  UserActivity,
  UserIdentityActivity,
  UserPaymentMethodActivity,
  LoanActivity,
  RepaymentActivity,
  Activities,
};
