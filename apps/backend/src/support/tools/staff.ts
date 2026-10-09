import { tool } from 'ai';
import { z } from 'zod';
import type { CustomerService } from 'src/admin/customers/customer.service';
import type { CustomersService } from 'src/admin/customers/customers.service';
import type { PrismaService } from 'src/database/prisma.service';
import type { RepaymentsService } from 'src/user/repayments/repayments.service';
import { maskEmail, maskPhone, pick } from '../redact';
import { CUSTOMER_KEYS } from './customer';

// Customer lookups for staff (CHAT_SUPPORT.md §1.4): they mirror what the caller's pages show. A marketer's are scoped
// to the customers whose account officer they are; a customer outside the scope is answered exactly like one that
// doesn't exist. Contact details are masked as for customers; the deep link opens the full record in the app.

export interface StaffToolDeps {
  prisma: Pick<PrismaService, 'customer'>;
  customers: Pick<CustomersService, 'getCustomers'>;
  customer: Pick<CustomerService, 'getInfo' | 'getSummary'>;
  repayments: Pick<RepaymentsService, 'getDeductions'>;
}

/** The scope of a marketer's lookups; null for admins (every customer). */
export type OfficerScope = string | null;

export const NOT_FOUND = { found: false, message: 'No customer with that id is available to you' } as const;

export const STAFF_KEYS = {
  // Never externalId: the IPPIS number is not the assistant's to show, so it never sees it (searching by one works).
  customerRow: ['id', 'name', 'status', 'repaymentRate'],
  summary: [
    'outstanding',
    'monthlyDeduction',
    'monthsLeft',
    'nextDeductionPeriod',
    'totalBorrowed',
    'totalRepaid',
    'penaltyCharged',
    'openRequests',
    'repaymentRate',
    'lastRepaymentPeriod',
  ],
} as const;

export const customerLink = (id: string) => `/customers/${id}`;

// Tool inputs carry no length or pattern rules: providers check them against the schema on their side (Groq does),
// and a call that misses fails the whole reply. The tools check them instead and answer in words.
const CUSTOMER_ID = z.object({
  customerId: z.string().describe('The customer id from a search result'),
});
const QUERY = z.object({
  query: z
    .string()
    .optional()
    .describe('A name, email, phone number or IPPIS number; leave it out (or empty) to list the first customers'),
});

/** Whether the customer is in the caller's scope (and exists). */
async function inScope(deps: StaffToolDeps, scope: OfficerScope, customerId: string): Promise<boolean> {
  const found = await deps.prisma.customer.findFirst({
    where: { userId: customerId, ...(scope && { accountOfficerId: scope }) },
    select: { userId: true },
  });
  return Boolean(found);
}

export function staffCustomerTools(deps: StaffToolDeps, scope: OfficerScope) {
  const find = tool({
    description: scope
      ? 'Search your own customers by name, email, phone or IPPIS number. Returns at most 10.'
      : 'Search customers by name, email, phone or IPPIS number. Returns at most 10.',
    inputSchema: QUERY,
    execute: async ({ query }) => {
      const search = query?.trim().slice(0, 100);
      const { data, meta } = await deps.customers.getCustomers({
        ...(search && search.length >= 2 && { search }),
        page: 1,
        limit: 10,
        ...(scope && { accountOfficerId: scope }),
      });
      return {
        customers: data.map((row) => ({
          ...pick(row, STAFF_KEYS.customerRow),
          email: maskEmail(row.email),
          phoneNumber: maskPhone(row.phoneNumber),
          link: customerLink(row.id),
        })),
        more: meta.total > data.length,
      };
    },
  });

  return {
    find,
    customer_summary: tool({
      description:
        "One customer's account: status, balance, monthly deduction, months left, the next deduction's month, open " +
        'requests and repayment rate.',
      inputSchema: CUSTOMER_ID,
      execute: async ({ customerId }) => {
        if (!(await inScope(deps, scope, customerId))) return NOT_FOUND;
        const [info, summary] = await Promise.all([deps.customer.getInfo(customerId), deps.customer.getSummary(customerId)]);
        return {
          found: true,
          customer: {
            id: info.id,
            name: info.name,
            status: info.status,
            email: maskEmail(info.email),
            phoneNumber: maskPhone(info.phoneNumber),
          },
          summary: pick(summary, STAFF_KEYS.summary),
          link: customerLink(customerId),
        };
      },
    }),
    customer_deductions: tool({
      description: "One customer's monthly payroll deductions, latest month first: expected, paid, outstanding, status.",
      inputSchema: CUSTOMER_ID,
      execute: async ({ customerId }) => {
        if (!(await inScope(deps, scope, customerId))) return NOT_FOUND;
        const { data, meta } = await deps.repayments.getDeductions(customerId, { page: 1, limit: 10 });
        return {
          found: true,
          deductions: data.map((row) => pick(row, CUSTOMER_KEYS.deduction)),
          more: meta.total > data.length,
          link: customerLink(customerId),
        };
      },
    }),
  };
}
