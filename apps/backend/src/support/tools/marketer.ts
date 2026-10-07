import { tool } from 'ai';
import { z } from 'zod';
import type { MarketerService } from 'src/marketer/marketer.service';
import { pick } from '../redact';
import { staffCustomerTools, type StaffToolDeps } from './staff';

// A marketer's lookups (CHAT_SUPPORT.md §1.4): only their own customers, through MarketerService and the
// accountOfficerId scope.

export interface MarketerToolDeps extends StaffToolDeps {
  marketer: Pick<MarketerService, 'overview' | 'repaymentOverview' | 'topupList' | 'assetRequestList'>;
}

const NO_INPUT = z.object({});
const ROWS = { page: 1, limit: 10 };

export function marketerTools(deps: MarketerToolDeps, marketerId: string) {
  const { find, customer_summary, customer_deductions } = staffCustomerTools(deps, marketerId);
  return {
    find_my_customers: find,
    customer_summary,
    customer_deductions,

    my_portfolio: tool({
      description:
        "Your portfolio: this month's deductions across your customers (expected, collected, by status) and what is " +
        'waiting on an admin.',
      inputSchema: NO_INPUT,
      execute: async () => {
        const [overview, repayments] = await Promise.all([
          deps.marketer.overview(marketerId),
          deps.marketer.repaymentOverview(marketerId),
        ]);
        return {
          deductions: { period: repayments.period.label, expected: repayments.expected, collected: repayments.collected, counts: repayments.counts },
          waiting: overview.waiting.slice(0, 10).map((item) => ({
            ...pick(item, ['kind', 'title', 'since', 'stage']),
            customer: item.customer ? { id: item.customer.id, name: item.customer.name } : null,
          })),
          link: '/dashboard',
        };
      },
    }),

    my_topups: tool({
      description: "Your customers' top-up requests, newest first, and where each is.",
      inputSchema: NO_INPUT,
      execute: async () => {
        const { data, meta } = await deps.marketer.topupList(marketerId, ROWS);
        return {
          topups: data.map((row) => ({
            ...pick(row, ['id', 'amount', 'status', 'requestedAt', 'disbursedAt', 'stage']),
            customer: { id: row.customer.id, name: row.customer.name },
          })),
          more: meta.total > data.length,
          link: '/loans',
        };
      },
    }),

    my_asset_requests: tool({
      description: "Your customers' asset (commodity) requests, newest first, and where each is.",
      inputSchema: NO_INPUT,
      execute: async () => {
        const { data, meta } = await deps.marketer.assetRequestList(marketerId, ROWS);
        return {
          requests: data.map((row) => ({
            ...pick(row, ['id', 'name', 'status', 'kind', 'amount', 'date', 'stage']),
            customer: { id: row.customer.id, name: row.customer.name },
          })),
          more: meta.total > data.length,
          link: '/loans',
        };
      },
    }),
  };
}

export type MarketerToolName = keyof ReturnType<typeof marketerTools>;
