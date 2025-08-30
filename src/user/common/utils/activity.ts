import {
  Loan,
  Repayment,
  User,
  UserIdentity,
  UserPaymentMethod,
} from '@prisma/client';
import type {
  ActivitySource,
  ActivitySummary,
  UserActivity,
  UserIdentityActivity,
  UserPaymentMethodActivity,
  LoanActivity,
  RepaymentActivity,
  Activities,
} from '../interface';

function summarizeUser(data: UserActivity): ActivitySummary {
  const createdAt = new Date(data.createdAt);
  const updatedAt = new Date(data.updatedAt ?? data.createdAt);

  return {
    title: 'Profile Activity',
    description:
      createdAt.getTime() === updatedAt.getTime()
        ? 'Your account was created.'
        : 'Profile updated.',
    date: updatedAt,
    source: 'User',
  };
}

function summarizeUserIdentity(data: UserIdentityActivity): ActivitySummary {
  const createdAt = new Date(data.createdAt);
  const updatedAt = new Date(data.updatedAt ?? data.createdAt);

  let description = '';
  if (createdAt.getTime() === updatedAt.getTime()) {
    description = 'Identity documents are submitted.';
  } else {
    description = 'Your identity is verified successfully.';
  }

  return {
    title: 'User Identity',
    description,
    date: updatedAt,
    source: 'UserIdentity',
  };
}

function summarizeUserPaymentMethod(
  data: UserPaymentMethodActivity,
): ActivitySummary {
  const createdAt = new Date(data.createdAt);
  const updatedAt = new Date(data.updatedAt ?? data.createdAt);

  return {
    title: 'Bank Info',
    description:
      createdAt.getTime() === updatedAt.getTime()
        ? `Bank account added (${data.bankName}).`
        : `Bank account updated (${data.bankName}).`,
    date: updatedAt,
    source: 'UserPaymentMethod',
  };
}

function summarizeLoan(data: LoanActivity): ActivitySummary {
  const createdAt = new Date(data.createdAt);
  const updatedAt = new Date(data.updatedAt ?? data.createdAt);

  if (createdAt.getTime() === updatedAt.getTime()) {
    return {
      title: 'Loan Created',
      description: `Loan of ₦${Number(data.amountBorrowed).toLocaleString()} created and awaiting approval.`,
      date: updatedAt,
      source: 'Loan',
    };
  }

  if (!data.disbursementDate) {
    return {
      title: 'Loan Status Update',
      description: `Loan ${data.status.toLowerCase()} by admin.`,
      date: updatedAt,
      source: 'Loan',
    };
  }

  if (data.status === 'DISBURSED') {
    return {
      title: 'Loan Disbursed',
      description: `Your loan request of ₦${Number(data.amountBorrowed).toLocaleString()} has been disbursed.`,
      date: updatedAt,
      source: 'Loan',
    };
  }

  if (data.status === 'REPAID') {
    return {
      title: 'Loan Repaid',
      description: `Loan of ₦${Number(data.amountBorrowed).toLocaleString()} is fully repaid.`,
      date: updatedAt,
      source: 'Loan',
    };
  }

  return {
    title: 'Loan Activity',
    description: 'Loan status updated.',
    date: updatedAt,
    source: 'Loan',
  };
}

function summarizeRepayment(data: RepaymentActivity): ActivitySummary {
  return {
    title: 'Loan Repayment',
    description: `₦${Number(data.repaidAmount).toLocaleString()} was used to repay loan ${data.loanId}.`,
    date: new Date(data.createdAt),
    source: 'Repayment',
  };
}

export function summarizeActivity(source: ActivitySource, data: Activities) {
  switch (source) {
    case 'User':
      return summarizeUser(data as User);
    case 'UserIdentity':
      return summarizeUserIdentity(data as UserIdentity);
    case 'UserPaymentMethod':
      return summarizeUserPaymentMethod(data as UserPaymentMethod);
    case 'Loan':
      return summarizeLoan(data as Loan);
    case 'Repayment':
      return summarizeRepayment(data as Repayment);
    default:
      return {
        title: 'Unknown Activity',
        description: 'No details available.',
        date: new Date(),
        source,
      };
  }
}
