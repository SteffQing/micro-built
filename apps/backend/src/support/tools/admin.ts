import { tool } from 'ai';
import { z } from 'zod';
import { periodLabel, parseYm } from '@microbuilt/shared';
import type { CashLoanService } from 'src/admin/loan/loan.service';
import type { VariationsAdminService } from 'src/admin/variations/variations.service';
import type { PrismaService } from 'src/database/prisma.service';
import { ADMIN_LINKS } from 'src/notifications/admin-notifier.service';
import { pick } from '../redact';
import { staffCustomerTools, type StaffToolDeps } from './staff';

// Admin and super-admin lookups (CHAT_SUPPORT.md §1.4): what their admin pages show, through the admin services.

export interface AdminToolDeps extends StaffToolDeps {
  prisma: Pick<PrismaService, 'customer' | 'organization'>;
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

export function adminTools(deps: AdminToolDeps) {
  const { find, customer_summary, customer_deductions } = staffCustomerTools(deps, null);
  return {
    find_customers: find,
    customer_summary,
    customer_deductions,

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
}

export type AdminToolName = keyof ReturnType<typeof adminTools>;
