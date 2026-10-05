import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { comparePeriods, parseYm, periodLabel, toYm, visibleEmail, type Period } from '@microbuilt/shared';
import type { AuditEntityType, Prisma } from '@prisma/client';
import { loanFiguresMany, toLoanFigures } from 'src/common/dto/loan.dto';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { money, sum, toNumber } from 'src/ledger/money';
import { lagosMonthOf, periodBounds } from 'src/ledger/period';
import { repaymentRates } from 'src/ledger/repayment-rate';
import type { Statement } from 'src/ledger/statement';
import { StatementService } from 'src/ledger/statement.service';
import type {
  CustomerReportAudience,
  CustomerReportDto,
  ReportCommodityDto,
  ReportLoanDto,
  ReportNotesDto,
  ReportRevenueDto,
} from './customer-report.dto';

/** How many audit entries an admin report lists. */
export const REPORT_HISTORY_LIMIT = 20;

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

const CUSTOMER = {
  userId: true,
  externalId: true,
  flagReason: true,
  user: { select: { name: true, email: true, phoneNumber: true, status: true } },
  payroll: { select: { organization: true, command: true } },
  identity: { select: { residencyAddress: true, stateResidency: true } },
  accountOfficer: { select: { userId: true, user: { select: { name: true } } } },
} satisfies Prisma.CustomerSelect;

const COMMODITY = {
  id: true,
  status: true,
  publicDetails: true,
  privateDetails: true,
  commodity: { select: { name: true } },
} satisfies Prisma.CommodityLoanSelect;

const LOAN = {
  id: true,
  status: true,
  category: true,
  principal: true,
  tenure: true,
  disbursementDate: true,
  // Top-ups for the summary; penalties only for their audit entries.
  microLoans: {
    where: { purpose: { in: ['TOPUP', 'PENALTY'] } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      purpose: true,
      amount: true,
      status: true,
      createdAt: true,
      disbursedAt: true,
      commodity: { select: COMMODITY },
    },
  },
  commodities: { select: { ...COMMODITY, microLoan: { select: { purpose: true } } } },
  tenureChanges: { select: { id: true } },
} satisfies Prisma.LoanSelect;

type LoanRow = Prisma.LoanGetPayload<{ select: typeof LOAN }>;
type CommodityRow = Prisma.CommodityLoanGetPayload<{ select: typeof COMMODITY }>;

// A customer's statement or report (V2.MD Stage 6): who they are, the loans of the range with the
// ledger's figures, the statement lines, totals, and — for admins only — revenue, private
// commodity details, the account officer and internal notes. Reads only.
@Injectable()
export class CustomerReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statements: StatementService,
    private readonly clock: LedgerClock,
  ) {}

  /**
   * `range.from` / `range.to` are YYYY-MM; by default the month of the first disbursement through
   * the current Lagos month (just the current month when nothing was ever disbursed).
   */
  async build(
    customerId: string,
    audience: CustomerReportAudience,
    range: { from?: string; to?: string } = {},
  ): Promise<CustomerReportDto> {
    for (const value of [range.from, range.to]) {
      if (value !== undefined && !YM.test(value)) throw new BadRequestException('Use YYYY-MM for `from` and `to`');
    }
    const now = this.clock.now();
    const customer = await this.prisma.customer.findUnique({ where: { userId: customerId }, select: CUSTOMER });
    if (!customer) throw new NotFoundException('Customer not found');

    const loans = await this.prisma.loan.findMany({
      where: { borrowerId: customerId },
      orderBy: { createdAt: 'asc' },
      select: LOAN,
    });
    const period = reportRange(loans, range, now);
    const booked = loans.filter((loan) => loan.status === 'DISBURSED' || loan.status === 'REPAID');
    const [statement, figures, rates] = await Promise.all([
      this.statements.lines({ customerId }, period, audience),
      loanFiguresMany(this.prisma, booked),
      repaymentRates(this.prisma, [customerId]),
    ]);

    const admin = audience === 'admin';
    const bounds = { start: periodBounds(period.from).start, end: periodBounds(period.to).end };
    const withLines = new Set(statement.lines.map((line) => line.loanId));
    const inRange = booked.filter(
      (loan) =>
        loan.disbursementDate !== null &&
        loan.disbursementDate < bounds.end &&
        (loan.status === 'DISBURSED' || loan.disbursementDate >= bounds.start || withLines.has(loan.id)),
    );

    const report: CustomerReportDto = {
      audience,
      generatedAt: now,
      range: {
        from: toYm(period.from),
        to: toYm(period.to),
        fromLabel: periodLabel(period.from),
        toLabel: periodLabel(period.to),
      },
      customer: {
        id: customer.userId,
        name: customer.user.name,
        externalId: customer.externalId,
        phoneNumber: customer.user.phoneNumber,
        email: visibleEmail(customer.user.email),
        organization: customer.payroll?.organization ?? null,
        command: customer.payroll?.command ?? null,
        address: customer.identity
          ? [customer.identity.residencyAddress, customer.identity.stateResidency].filter(Boolean).join(', ')
          : null,
        status: customer.user.status,
      },
      loans: inRange.map((loan): ReportLoanDto => {
        const opening = loan.commodities.find((c) => c.microLoan?.purpose === 'NEW_LOAN');
        return {
          id: loan.id,
          status: loan.status,
          category: loan.category,
          disbursementDate: loan.disbursementDate,
          ...(figures.get(loan.id) ?? toLoanFigures(loan, undefined, null)),
          commodity: opening ? toCommodity(opening, admin) : null,
          topups: loan.microLoans
            .filter((m) => m.purpose === 'TOPUP' && m.status !== 'REJECTED')
            .map((m) => ({
              id: m.id,
              amount: toNumber(m.amount),
              status: m.status,
              requestedAt: m.createdAt,
              disbursedAt: m.disbursedAt,
              commodity: m.commodity ? toCommodity(m.commodity, admin) : null,
            })),
        };
      }),
      statement,
      totals: {
        repaid: statement.credits,
        outstanding: toNumber(sum(booked.map((loan) => figures.get(loan.id)?.outstanding ?? 0))),
        repaymentRate: rates.get(customerId) ?? 100,
      },
    };
    if (!admin) return report;

    report.revenue = revenue(statement);
    report.accountOfficer = customer.accountOfficer
      ? { id: customer.accountOfficer.userId, name: customer.accountOfficer.user.name }
      : null;
    report.notes = await this.notes(customerId, customer.flagReason, loans);
    return report;
  }

  /** The flag reason and the last audit entries about the customer, their loans and their payments. */
  private async notes(customerId: string, flagReason: string | null, loans: LoanRow[]): Promise<ReportNotesDto> {
    const inflows = await this.prisma.paymentInflow.findMany({ where: { customerId }, select: { id: true } });
    const subjects: [AuditEntityType, string[]][] = [
      ['USER', [customerId]],
      ['LOAN', loans.map((loan) => loan.id)],
      ['MICRO_LOAN', loans.flatMap((loan) => loan.microLoans.map((m) => m.id))],
      ['COMMODITY_LOAN', loans.flatMap((loan) => loan.commodities.map((c) => c.id))],
      ['TENURE_CHANGE', loans.flatMap((loan) => loan.tenureChanges.map((t) => t.id))],
      ['PAYMENT_INFLOW', inflows.map((inflow) => inflow.id)],
    ];
    const entries = await this.prisma.auditLog.findMany({
      where: {
        OR: subjects
          .filter(([, ids]) => ids.length > 0)
          .map(([entityType, ids]) => ({ entityType, entityId: { in: ids } })),
      },
      orderBy: { createdAt: 'desc' },
      take: REPORT_HISTORY_LIMIT,
      select: { action: true, note: true, createdAt: true, actor: { select: { user: { select: { name: true } } } } },
    });
    return {
      flagReason,
      history: entries.map((entry) => ({
        action: entry.action,
        note: entry.note,
        actorName: entry.actor.user.name,
        createdAt: entry.createdAt,
      })),
    };
  }
}

function reportRange(
  loans: Pick<LoanRow, 'disbursementDate'>[],
  range: { from?: string; to?: string },
  now: Date,
): { from: Period; to: Period } {
  const to = range.to ? parseYm(range.to) : lagosMonthOf(now);
  if (range.from) {
    const from = parseYm(range.from);
    if (comparePeriods(from, to) > 0) throw new BadRequestException('`from` must not be after `to`');
    return { from, to };
  }
  const disbursed = loans.flatMap((loan) => (loan.disbursementDate ? [loan.disbursementDate.getTime()] : []));
  if (disbursed.length === 0) return { from: to, to };
  const first = lagosMonthOf(new Date(Math.min(...disbursed)));
  // A `to` before the first loan is an empty report, not an error.
  return { from: comparePeriods(first, to) > 0 ? to : first, to };
}

function toCommodity(row: CommodityRow, admin: boolean): ReportCommodityDto {
  return {
    name: row.commodity.name,
    details: row.publicDetails,
    ...(admin ? { privateDetails: row.privateDetails } : {}),
  };
}

/** Booked and collected within the range, from the admin statement's lines. */
function revenue(statement: Statement): ReportRevenueDto {
  const total = (pick: (line: Statement['lines'][number]) => number | undefined) =>
    toNumber(sum(statement.lines.map((line) => money(pick(line) ?? 0))));
  return {
    interestBooked: total((line) => (line.type === 'INTEREST' ? line.debit : 0)),
    interestCollected: total((line) => line.split?.interest),
    managementFee: total((line) => line.managementFee),
    penaltyCharged: total((line) => (line.type === 'PENALTY' ? line.debit : 0)),
    penaltyCollected: total((line) => line.split?.penalty),
  };
}
