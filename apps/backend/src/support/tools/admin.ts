import { tool } from 'ai';
import { z } from 'zod';
import { periodLabel, parseYm } from '@microbuilt/shared';
import type { CashLoanService } from 'src/admin/loan/loan.service';
import type { VariationsAdminService } from 'src/admin/variations/variations.service';
import type { PrismaService } from 'src/database/prisma.service';
import { ADMIN_LINKS } from 'src/notifications/admin-notifier.service';
import { pick } from '../redact';
import { STAFF_KEYS, customerLink, staffCustomerTools, type StaffToolDeps } from './staff';

// Admin and super-admin lookups (CHAT_SUPPORT.md §1.4): what their admin pages show, through the admin services.

export interface AdminToolDeps extends StaffToolDeps {
  prisma: Pick<PrismaService, 'customer' | 'organization' | 'admin'>;
  cashLoans: Pick<CashLoanService, 'getLoan'>;
  variations: Pick<VariationsAdminService, 'preview'>;
}

export const LOAN_KEYS = [
  'id',
  'category',
  'status',
  'disbursementDate',
  'principal',
  'owed',
  'repaid',
  'outstanding',
  'monthly',
  'tenure',
  'remainingMonths',
  'interestRate',
  'managementFeeRate',
  'createdAt',
] as const;

const LOAN_ID = z.object({ loanId: z.string().min(1).max(64).describe('The loan id, e.g. LN-4KD8QZ') });
const ORG_MONTH = z.object({
  organization: z.string().min(2).max(100).describe("The organization's name (or part of it)"),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .describe('The payroll month as YYYY-MM, e.g. 2026-10'),
});

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MARKETER'] as const;
const STAFF_PAGE = 50;

/** `userId` is the caller (from the session); `superAdmin` adds the staff list. */
export function adminTools(deps: AdminToolDeps, userId: string, superAdmin: boolean) {
  const { find, customer_summary, customer_deductions } = staffCustomerTools(deps, null);
  const tools = {
    find_customers: find,
    customer_summary,
    customer_deductions,

    my_customers: tool({
      description:
        "The customers whose account officer is the caller (the ones they signed up or were given), by name. " +
        'Returns at most 20 a page.',
      inputSchema: z.object({ page: z.number().int().min(1).max(50).default(1).describe('Page, from 1') }),
      execute: async ({ page }) => {
        const { data, meta } = await deps.customers.getCustomers({ accountOfficerId: userId, page, limit: 20 });
        return {
          total: meta.total,
          page,
          customers: data.map((row) => ({ ...pick(row, STAFF_KEYS.customerRow), link: customerLink(row.id) })),
          more: meta.total > page * 20,
          link: '/customers',
        };
      },
    }),

    loan_details: tool({
      description: "One cash loan: status, amounts, the monthly deduction, months left, its rates, and the borrower.",
      inputSchema: LOAN_ID,
      execute: async ({ loanId }) => {
        const loan = await deps.cashLoans.getLoan(loanId.trim().toUpperCase()).catch(() => null);
        if (!loan) return { found: false, message: 'No loan with that id' };
        return {
          found: true,
          loan: pick(loan, LOAN_KEYS),
          borrower: { id: loan.borrower.id, name: loan.borrower.name },
          topups: loan.topups.slice(0, 10).map((topup) => pick(topup, ['amount', 'status', 'requestedAt', 'disbursedAt'])),
          link: ADMIN_LINKS.loan(loan.id),
        };
      },
    }),

    org_variation_status: tool({
      description:
        "An organization's payroll variation for a month: whether it was generated (and its version), whether a voucher " +
        "or No payroll locked it, the start/amend/stop counts, and what blocks generating it.",
      inputSchema: ORG_MONTH,
      execute: async ({ organization, month }) => {
        const matches = await deps.prisma.organization.findMany({
          where: { name: { contains: organization.trim(), mode: 'insensitive' } },
          orderBy: { name: 'asc' },
          take: 5,
          select: { id: true, name: true },
        });
        if (matches.length === 0) return { found: false, message: 'No organization with that name' };
        if (matches.length > 1 && !matches.some((m) => m.name.toLowerCase() === organization.trim().toLowerCase())) {
          return { found: false, message: 'More than one organization matches', candidates: matches.map((m) => m.name) };
        }
        const org = matches.find((m) => m.name.toLowerCase() === organization.trim().toLowerCase()) ?? matches[0];
        const preview = await deps.variations.preview({ organizationId: org.id, period: month });
        return {
          found: true,
          organization: org.name,
          period: periodLabel(parseYm(month)),
          generated: preview.variation
            ? {
                version: preview.variation.version,
                updatedAt: preview.variation.updatedAt,
                lockedBy: preview.variation.lock?.kind ?? null,
                regenerateHint: preview.variation.regenerateHint,
              }
            : null,
          counts: preview.counts,
          skipped: preview.skipped,
          generateBlockedBy: preview.generateBlockedBy,
          link: ADMIN_LINKS.variation(org.id, month),
        };
      },
    }),
  };
  if (!superAdmin) return tools;
  return {
    ...tools,
    // Super admins only: the staff behind the Account officers page.
    list_admins: tool({
      description:
        'Super admins: everyone on staff (super admins, admins and marketers), with their role and whether their ' +
        'account is active. Optionally only one role.',
      inputSchema: z.object({ role: z.enum(STAFF_ROLES).optional().describe('Only this role') }),
      execute: async ({ role }) => {
        const rows = await deps.prisma.admin.findMany({
          where: { role: role ? role : { in: [...STAFF_ROLES] } },
          orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
          take: STAFF_PAGE,
          select: { role: true, user: { select: { name: true, status: true } } },
        });
        return {
          staff: rows.map((row) => ({ name: row.user.name, role: row.role, status: row.user.status })),
          more: rows.length === STAFF_PAGE,
          link: '/account-officers',
        };
      },
    }),
  };
}

export type AdminToolName = keyof ReturnType<typeof adminTools> | 'list_admins';
