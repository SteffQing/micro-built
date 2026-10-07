import { tool } from 'ai';
import { z } from 'zod';
import type { ChangeRequestsService } from 'src/change-requests/change-requests.service';
import type { LiquidationRequestsService } from 'src/liquidations/liquidation-requests.service';
import type { InappService } from 'src/notifications/inapp.service';
import type { LoanService } from 'src/user/loan/loan.service';
import type { RepaymentsService } from 'src/user/repayments/repayments.service';
import type { UserService } from 'src/user/user.service';
import { capRows, maskAccount, pick } from '../redact';

// A customer's own data (CHAT_SUPPORT.md §1.4). No tool takes an id: each reads the caller's own records, with the
// caller's id from the session. Every result is a whitelist of keys (the spec snapshots them), so a field added to a
// service never reaches the model unreviewed, and C5's list (global rates, eligibility, flag reasons, change-request
// notes, asset costs, the account officer) never does.

export interface CustomerToolDeps {
  users: Pick<UserService, 'getOverview' | 'getPaymentMethod'>;
  loans: Pick<LoanService, 'getOverview' | 'getCommodityRequests'>;
  repayments: Pick<RepaymentsService, 'getOverview' | 'getRepayments' | 'getDeductions'>;
  liquidations: Pick<LiquidationRequestsService, 'preview' | 'history'>;
  changeRequests: Pick<ChangeRequestsService, 'listOwn'>;
  notifications: Pick<InappService, 'getUserNotifications'>;
}

const NO_INPUT = z.object({});
const ROWS = { page: 1, limit: 10 };

export const CUSTOMER_KEYS = {
  loan: ['id', 'category', 'status', 'principal', 'owed', 'repaid', 'outstanding', 'monthly', 'tenure', 'remainingMonths', 'disbursementDate'],
  deduction: ['period', 'expected', 'paid', 'outstanding', 'status'],
  repayment: ['period', 'amount', 'date', 'source', 'deductionStatus'],
  liquidation: ['amount', 'state', 'requestedAt', 'decidedAt'],
  preview: ['outstanding', 'principalOutstanding', 'interestOutstanding', 'penaltyOutstanding', 'remainingMonths', 'monthly', 'endPeriod'],
  assetRequest: ['name', 'status', 'kind', 'amount', 'details', 'date', 'stage'],
  changeRequest: ['kind', 'status', 'createdAt', 'decidedAt'],
  notification: ['title', 'isRead', 'createdAt'],
} as const;

export function customerTools(deps: CustomerToolDeps, userId: string) {
  return {
    my_overview: tool({
      description: "The customer's dashboard: their live loan, next and last deduction, pending requests, repayment rate.",
      inputSchema: NO_INPUT,
      execute: async () => {
        const overview = await deps.users.getOverview(userId);
        return {
          currentLoan: overview.currentLoan ? pick(overview.currentLoan, CUSTOMER_KEYS.loan) : null,
          nextDeduction: overview.nextDeduction,
          lastDeduction: overview.lastDeduction
            ? { amount: overview.lastDeduction.amount, period: overview.lastDeduction.period }
            : null,
          pendingRequests: overview.pendingRequests,
          repaymentRate: overview.repaymentRate,
          link: '/dashboard',
        };
      },
    }),

    my_loan: tool({
      description:
        "The customer's loan: status, amount, what is owed, repaid and left, the monthly deduction, months left, the " +
        "running loan's own rates, and loan or top-up requests waiting for review.",
      inputSchema: NO_INPUT,
      execute: async () => {
        const [overview, loans] = await Promise.all([deps.users.getOverview(userId), deps.loans.getOverview(userId)]);
        return {
          loan: overview.currentLoan ? pick(overview.currentLoan, CUSTOMER_KEYS.loan) : null,
          runningLoanRates: loans.runningLoanRates
            ? { ...loans.runningLoanRates, unit: 'percent per month (interest), percent once (management fee)' }
            : null,
          pendingLoans: loans.pendingLoans.slice(0, 10).map((loan) => pick(loan, ['amount', 'category', 'status', 'date'])),
          pendingTopups: loans.pendingTopups.slice(0, 10).map((topup) => pick(topup, ['amount', 'status'])),
          counts: { approved: loans.approvedCount, disbursed: loans.disbursedCount, repaid: loans.repaidCount, rejected: loans.rejectedCount },
          link: '/loan-request',
        };
      },
    }),

    my_deductions: tool({
      description: "The customer's monthly payroll deductions, latest month first: expected, paid, outstanding, status.",
      inputSchema: NO_INPUT,
      execute: async () => {
        const { data, meta } = await deps.repayments.getDeductions(userId, ROWS);
        return { deductions: data.map((row) => pick(row, CUSTOMER_KEYS.deduction)), more: meta.total > data.length, link: '/repayments' };
      },
    }),

    my_repayments: tool({
      description: "Money applied to the customer's loans, newest first, with totals (repaid, outstanding, missed months).",
      inputSchema: NO_INPUT,
      execute: async () => {
        const [overview, { data, meta }] = await Promise.all([
          deps.repayments.getOverview(userId),
          deps.repayments.getRepayments(userId, ROWS),
        ]);
        return {
          totals: pick(overview, ['totalRepaid', 'outstanding', 'repaymentsCount', 'missedCount']),
          repayments: data.map((row) => pick(row, CUSTOMER_KEYS.repayment)),
          more: meta.total > data.length,
          link: '/repayments',
        };
      },
    }),

    my_liquidations: tool({
      description: "The customer's early-payment (liquidation) requests and their state, and what clears the loan today.",
      inputSchema: NO_INPUT,
      execute: async () => {
        const [history, preview] = await Promise.all([
          deps.liquidations.history(userId, 1, 10),
          deps.liquidations.preview(userId).catch(() => null),
        ]);
        const { rows, more } = capRows(history.items);
        return {
          requests: rows.map((row) => pick(row, CUSTOMER_KEYS.liquidation)),
          more,
          payoffToday: preview ? pick(preview, CUSTOMER_KEYS.preview) : null,
          link: '/repayments',
        };
      },
    }),

    my_asset_requests: tool({
      description: "The customer's asset (commodity) requests and where each is.",
      inputSchema: NO_INPUT,
      execute: async () => {
        const { data, meta } = await deps.loans.getCommodityRequests(userId, ROWS);
        return { requests: data.map((row) => pick(row, CUSTOMER_KEYS.assetRequest)), more: meta.total > data.length, link: '/loan-request' };
      },
    }),

    my_change_requests: tool({
      description: "Changes the customer asked for to their details (profile, identity, bank account): kind, status, dates.",
      inputSchema: NO_INPUT,
      execute: async () => {
        const { items, meta } = await deps.changeRequests.listOwn(userId, ROWS);
        return { requests: items.map((row) => pick(row, CUSTOMER_KEYS.changeRequest)), more: meta.total > items.length, link: '/settings' };
      },
    }),

    my_notifications: tool({
      description: "The customer's latest notifications (titles only).",
      inputSchema: NO_INPUT,
      execute: async () => {
        const { notifications, unreadCount } = await deps.notifications.getUserNotifications(userId, 1, 10);
        return { notifications: notifications.map((row) => pick(row, CUSTOMER_KEYS.notification)), unreadCount, link: '/notifications' };
      },
    }),

    my_payment_method: tool({
      description: 'The bank account loans are paid into: the bank and the last four digits only.',
      inputSchema: NO_INPUT,
      execute: async () => {
        const method = await deps.users.getPaymentMethod(userId);
        return {
          paymentMethod: method ? { bankName: method.bankName, accountNumber: maskAccount(method.accountNumber) } : null,
          link: '/settings',
        };
      },
    }),
  };
}

export type CustomerToolName = keyof ReturnType<typeof customerTools>;
