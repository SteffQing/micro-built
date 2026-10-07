import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { comparePeriods, parseYm, periodLabel, toYm, visibleEmail, type Period } from '@microbuilt/shared';
import type { AdminRole, CommodityRequestStatus, DeductionStatus, LoanStatus, MicroLoanStatus, Prisma } from '@prisma/client';
import { CashLoanService, CommodityLoanService } from 'src/admin/loan/loan.service';
import { TopupService } from 'src/admin/loan/topup.service';
import { RepaymentsService } from 'src/admin/repayments/repayments.service';
import type { CashLoanQueryDto, CommodityLoanQueryDto, TopupQueryDto } from 'src/admin/common/dto/loan.dto';
import type { FilterDeductionsDto } from 'src/admin/common/dto/repayment.dto';
import type { CashLoanDto, CommodityLoanDto, TopupItemDto } from 'src/admin/common/entities/loan.entities';
import { captureJobError } from 'src/common/observability';
import { formatCurrency } from 'src/common/utils';
import { toNumber } from 'src/ledger/money';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { SYSTEM_ACTOR_ID } from 'src/ledger/ledger.constants';
import { lagosMonthOf } from 'src/ledger/period';
import { MARKETER_FLAG_REASON } from 'src/admin/customers/customers.service';
import { ADMIN_LINKS, NOTIFICATION_SUBJECT } from 'src/notifications/admin-notifier.service';
import { InappService } from 'src/notifications/inapp.service';
import { MailService } from 'src/notifications/mail.service';
import type {
  EscalateDto,
  EscalationKind,
  EscalationResultDto,
  EscalationStage,
  MarketerAdminDto,
  MarketerAssetRequestItemDto,
  MarketerCashLoanItemDto,
  MarketerOverviewDto,
  MarketerRepaymentOverviewDto,
  MarketerTopupItemDto,
  WaitingItemDto,
} from './marketer.dto';

/** One escalation per admin per item and stage in this window. */
export const ESCALATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const WAITING_LIMIT = 20;

export const LOAN_NOT_FOUND = 'Loan not found';
export const TOPUP_NOT_FOUND = 'Top-up not found';
export const ASSET_REQUEST_NOT_FOUND = 'Asset request not found';

/** Who acts at each stage: any admin decides, only a super admin disburses. */
const ACTING_ROLES: Record<EscalationStage, AdminRole[]> = {
  DECISION: ['ADMIN', 'SUPER_ADMIN'],
  DISBURSEMENT: ['SUPER_ADMIN'],
};
const STAGE_TEXT: Record<EscalationStage, string> = {
  DECISION: 'Waiting for approval',
  DISBURSEMENT: 'Approved, waiting for disbursement',
};

export function loanStage(status: LoanStatus | MicroLoanStatus): EscalationStage | null {
  if (status === 'PENDING') return 'DECISION';
  if (status === 'APPROVED') return 'DISBURSEMENT';
  return null;
}

/** In review: a decision. Approved, with its loan (a new asset loan) or top-up (on a running loan) not yet paid out: disbursement. */
export function assetStage(
  status: CommodityRequestStatus,
  loanStatus: LoanStatus,
  topupStatus: MicroLoanStatus | null,
): EscalationStage | null {
  if (status === 'IN_REVIEW') return 'DECISION';
  if (status === 'APPROVED' && (loanStatus === 'APPROVED' || topupStatus === 'APPROVED')) return 'DISBURSEMENT';
  return null;
}

const category = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

interface EscalationTarget {
  stage: EscalationStage | null;
  customer: { id: string; name: string };
  /** "Cash loan LN-4KD8QZ of ₦250,000", for the message. */
  what: string;
  link: string;
}

/**
 * A marketer's own work: their customers' loans, asset requests, top-ups and deductions (never anyone else's), what
 * waits on an admin, and escalating it to one admin or to everyone who can act on it.
 */
@Injectable()
export class MarketerService {
  private readonly logger = new Logger(MarketerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cashLoans: CashLoanService,
    private readonly assets: CommodityLoanService,
    private readonly topups: TopupService,
    private readonly repayments: RepaymentsService,
    private readonly inapp: InappService,
    private readonly mail: MailService,
    private readonly clock: LedgerClock,
  ) {}

  // ── Lists ────────────────────────────────────────────────────────────────

  async cashLoanList(marketerId: string, query: CashLoanQueryDto) {
    const result = await this.cashLoans.getAllLoans(query, { borrower: { accountOfficerId: marketerId } });
    const stages = result.data.map((loan) => ({ id: loan.id, stage: loanStage(loan.status) }));
    const last = await this.lastEscalations('LOAN', stages);
    const data: MarketerCashLoanItemDto[] = result.data.map((loan, i) => ({
      ...loan,
      stage: stages[i].stage,
      lastEscalatedAt: last.get(loan.id) ?? null,
    }));
    return { ...result, data, message: "Your customers' loans" };
  }

  async assetRequestList(marketerId: string, query: CommodityLoanQueryDto) {
    const result = await this.assets.getAllLoans(query, { loan: { borrower: { accountOfficerId: marketerId } } });
    const topups = await this.prisma.commodityLoan.findMany({
      where: { id: { in: result.data.map((row) => row.id) } },
      select: { id: true, microLoan: { select: { status: true } } },
    });
    const topupStatus = new Map(topups.map((row) => [row.id, row.microLoan?.status ?? null]));
    const stages = result.data.map((row) => ({
      id: row.id,
      stage: assetStage(row.status, row.loanStatus, topupStatus.get(row.id) ?? null),
    }));
    const last = await this.lastEscalations('ASSET_REQUEST', stages);
    const data: MarketerAssetRequestItemDto[] = result.data.map((row, i) => ({
      ...row,
      stage: stages[i].stage,
      lastEscalatedAt: last.get(row.id) ?? null,
    }));
    return { ...result, data, message: "Your customers' asset requests" };
  }

  async topupList(marketerId: string, query: TopupQueryDto) {
    const result = await this.topups.list(query, { loan: { borrower: { accountOfficerId: marketerId } } });
    const stages = result.data.map((row) => ({ id: row.id, stage: loanStage(row.status) }));
    const last = await this.lastEscalations('TOPUP', stages);
    const data: MarketerTopupItemDto[] = result.data.map((row, i) => ({
      ...row,
      stage: stages[i].stage,
      lastEscalatedAt: last.get(row.id) ?? null,
    }));
    return { ...result, data, message: "Your customers' top-ups" };
  }

  // ── One item (404 unless it is one of the marketer's customers') ──────────

  async loan(marketerId: string, id: string): Promise<CashLoanDto> {
    const own = await this.prisma.loan.count({ where: { id, borrower: { accountOfficerId: marketerId } } });
    if (!own) throw new NotFoundException(LOAN_NOT_FOUND);
    return this.cashLoans.getLoan(id);
  }

  async assetRequest(marketerId: string, id: string): Promise<CommodityLoanDto> {
    const own = await this.prisma.commodityLoan.count({
      where: { id, loan: { borrower: { accountOfficerId: marketerId } } },
    });
    if (!own) throw new NotFoundException(ASSET_REQUEST_NOT_FOUND);
    // The private details (supplier, cost) are for admins.
    return { ...(await this.assets.getLoan(id)), privateDetails: null };
  }

  async topup(marketerId: string, id: string): Promise<TopupItemDto> {
    const own = await this.prisma.microLoan.count({
      where: { id, purpose: 'TOPUP', loan: { borrower: { accountOfficerId: marketerId } } },
    });
    if (!own) throw new NotFoundException(TOPUP_NOT_FOUND);
    return this.topups.get(id);
  }

  // ── Repayments ───────────────────────────────────────────────────────────

  listDeductions(marketerId: string, query: FilterDeductionsDto) {
    return this.repayments.listDeductions(query, { loan: { borrower: { accountOfficerId: marketerId } } });
  }

  /** One payroll month of the marketer's customers' deductions: expected, collected, and how many ended how. */
  async repaymentOverview(marketerId: string, ym?: string): Promise<MarketerRepaymentOverviewDto> {
    const own: Prisma.DeductionWhereInput = { loan: { borrower: { accountOfficerId: marketerId } } };
    let period: Period;
    if (ym) {
      period = parseYm(ym);
    } else {
      const latest = await this.prisma.deduction.findFirst({
        where: own,
        orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
        select: { period: { select: { year: true, month: true } } },
      });
      const now = lagosMonthOf(this.clock.now());
      period = latest && comparePeriods(latest.period, now) <= 0 ? latest.period : now;
    }
    const where: Prisma.DeductionWhereInput = { ...own, period: { year: period.year, month: period.month } };
    const [groups, collected] = await Promise.all([
      this.prisma.deduction.groupBy({ by: ['status'], where, _count: { _all: true }, _sum: { expected: true } }),
      this.prisma.repayment.aggregate({ where: { deduction: where }, _sum: { amount: true } }),
    ]);
    const counts: Record<DeductionStatus, number> = { OPEN: 0, AWAITING: 0, FULFILLED: 0, PARTIAL: 0, FAILED: 0 };
    let expected = 0;
    for (const group of groups) {
      counts[group.status] = group._count._all;
      expected += toNumber(group._sum.expected ?? 0);
    }
    return {
      period: { ym: toYm(period), label: periodLabel(period) },
      expected: Math.round(expected * 100) / 100,
      collected: toNumber(collected._sum.amount ?? 0),
      counts,
    };
  }

  // ── What waits on an admin ───────────────────────────────────────────────

  async overview(marketerId: string): Promise<MarketerOverviewDto> {
    const borrower = { accountOfficerId: marketerId };
    const customerRef = { select: { userId: true, externalId: true, user: { select: { name: true } } } } as const;
    const [customers, loans, requests, topups, organizations] = await Promise.all([
      this.prisma.customer.findMany({
        where: { ...borrower, user: { status: 'FLAGGED' } },
        orderBy: { createdAt: 'asc' },
        take: WAITING_LIMIT,
        select: { userId: true, externalId: true, flagReason: true, createdAt: true, user: { select: { name: true } } },
      }),
      this.prisma.loan.findMany({
        where: { borrower, status: { in: ['PENDING', 'APPROVED'] }, category: { not: 'ASSET_PURCHASE' } },
        orderBy: { createdAt: 'asc' },
        take: WAITING_LIMIT,
        select: { id: true, status: true, category: true, principal: true, createdAt: true, borrower: customerRef },
      }),
      this.prisma.commodityLoan.findMany({
        where: {
          loan: { borrower },
          OR: [
            { status: 'IN_REVIEW' },
            { status: 'APPROVED', loan: { status: 'APPROVED' } },
            { status: 'APPROVED', microLoan: { status: 'APPROVED' } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: WAITING_LIMIT,
        select: {
          id: true,
          status: true,
          createdAt: true,
          commodity: { select: { name: true } },
          microLoan: { select: { status: true } },
          loan: { select: { status: true, borrower: customerRef } },
        },
      }),
      this.prisma.microLoan.findMany({
        where: {
          purpose: 'TOPUP',
          status: { in: ['PENDING', 'APPROVED'] },
          loan: { borrower },
          // An asset top-up is followed as its asset request.
          commodity: { is: null },
        },
        orderBy: { createdAt: 'asc' },
        take: WAITING_LIMIT,
        select: { id: true, status: true, amount: true, createdAt: true, loan: { select: { borrower: customerRef } } },
      }),
      this.prisma.organization.findMany({
        where: { status: 'PENDING', requestedById: marketerId },
        orderBy: { createdAt: 'asc' },
        take: WAITING_LIMIT,
        select: { id: true, name: true, createdAt: true },
      }),
    ]);

    const ref = (row: { userId: string; externalId: string | null; user: { name: string } }) => ({
      id: row.userId,
      name: row.user.name,
      externalId: row.externalId,
    });
    const waiting: WaitingItemDto[] = [
      ...customers.map((row) => ({
        kind: 'CUSTOMER' as const,
        id: row.userId,
        title: 'New customer account',
        detail:
          row.flagReason === MARKETER_FLAG_REASON
            ? 'Waiting for an admin to review and activate it'
            : `Suspended${row.flagReason ? `: ${row.flagReason}` : ''}`,
        customer: ref(row),
        since: row.createdAt,
        escalation: null,
        stage: null,
        lastEscalatedAt: null,
      })),
      ...loans.map((row) => {
        const stage = loanStage(row.status);
        return {
          kind: 'LOAN' as const,
          id: row.id,
          title: `${category(row.category)} loan${row.principal.isZero() ? '' : ` of ${formatCurrency(toNumber(row.principal))}`}`,
          detail: stage ? STAGE_TEXT[stage] : '',
          customer: ref(row.borrower),
          since: row.createdAt,
          escalation: 'LOAN' as const,
          stage,
          lastEscalatedAt: null as Date | null,
        };
      }),
      ...requests.map((row) => {
        const stage = assetStage(row.status, row.loan.status, row.microLoan?.status ?? null);
        return {
          kind: 'ASSET_REQUEST' as const,
          id: row.id,
          title: `Asset request: ${row.commodity.name}`,
          detail: stage ? STAGE_TEXT[stage] : '',
          customer: ref(row.loan.borrower),
          since: row.createdAt,
          escalation: 'ASSET_REQUEST' as const,
          stage,
          lastEscalatedAt: null as Date | null,
        };
      }),
      ...topups.map((row) => {
        const stage = loanStage(row.status);
        return {
          kind: 'TOPUP' as const,
          id: row.id,
          title: `Top-up of ${formatCurrency(toNumber(row.amount))}`,
          detail: stage ? STAGE_TEXT[stage] : '',
          customer: ref(row.loan.borrower),
          since: row.createdAt,
          escalation: 'TOPUP' as const,
          stage,
          lastEscalatedAt: null as Date | null,
        };
      }),
      ...organizations.map((row) => ({
        kind: 'ORGANIZATION' as const,
        id: row.id,
        title: `New organization: ${row.name}`,
        detail: 'Waiting for a super admin to approve it',
        customer: null,
        since: row.createdAt,
        escalation: null,
        stage: null,
        lastEscalatedAt: null,
      })),
    ];

    const subjects = waiting.flatMap((item) =>
      item.escalation && item.stage ? [NOTIFICATION_SUBJECT.escalation(item.escalation, item.id, item.stage)] : [],
    );
    const last = await this.lastBySubject(subjects);
    for (const item of waiting) {
      if (item.escalation && item.stage) {
        item.lastEscalatedAt = last.get(NOTIFICATION_SUBJECT.escalation(item.escalation, item.id, item.stage)) ?? null;
      }
    }
    waiting.sort((a, b) => a.since.getTime() - b.since.getTime());
    return { waiting };
  }

  // ── Escalating ───────────────────────────────────────────────────────────

  /** Active admins and super admins (never the system account), for the "who to ask" picker. */
  async admins(): Promise<MarketerAdminDto[]> {
    const rows = await this.prisma.admin.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, userId: { not: SYSTEM_ACTOR_ID }, user: { status: 'ACTIVE' } },
      orderBy: { user: { name: 'asc' } },
      select: { userId: true, role: true, user: { select: { name: true } } },
    });
    return rows.map((row) => ({ id: row.userId, name: row.user.name, role: row.role }));
  }

  /**
   * Asks one admin (or everyone who can act on it now) to look at a loan, asset request or top-up of the marketer's
   * customer: in-app and by email. Each admin is asked at most once a day about the same item at the same stage.
   */
  async escalate(marketer: { userId: string }, dto: EscalateDto): Promise<EscalationResultDto> {
    const target = await this.target(marketer.userId, dto.kind, dto.id);
    if (!target.stage) throw new ConflictException('This has already been decided: there is nothing to escalate');
    const stage = target.stage;

    let recipients: { userId: string; name: string; email: string | null }[];
    const select = { userId: true, role: true, user: { select: { name: true, email: true } } } as const;
    if (dto.adminId) {
      const admin = await this.prisma.admin.findFirst({
        where: { userId: dto.adminId, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, user: { status: 'ACTIVE' } },
        select,
      });
      if (!admin || admin.userId === SYSTEM_ACTOR_ID) throw new NotFoundException('No such admin');
      if (!ACTING_ROLES[stage].includes(admin.role)) {
        throw new BadRequestException(`Only a super admin can disburse: ask a super admin, or ask everyone`);
      }
      recipients = [{ userId: admin.userId, name: admin.user.name, email: admin.user.email }];
    } else {
      const admins = await this.prisma.admin.findMany({
        where: { role: { in: ACTING_ROLES[stage] }, userId: { not: SYSTEM_ACTOR_ID }, user: { status: 'ACTIVE' } },
        select,
      });
      recipients = admins.map((admin) => ({ userId: admin.userId, name: admin.user.name, email: admin.user.email }));
    }
    if (recipients.length === 0) throw new ConflictException('There is no admin to ask right now');

    const subject = NOTIFICATION_SUBJECT.escalation(dto.kind, dto.id, stage);
    const now = this.clock.now();
    const recent = await this.prisma.notification.findMany({
      where: {
        subject,
        userId: { in: recipients.map((r) => r.userId) },
        createdAt: { gte: new Date(now.getTime() - ESCALATION_COOLDOWN_MS) },
      },
      select: { userId: true },
    });
    const asked = new Set(recent.map((row) => row.userId));
    const fresh = recipients.filter((r) => !asked.has(r.userId));
    const skipped = recipients.filter((r) => asked.has(r.userId)).map((r) => r.name);
    if (fresh.length === 0) {
      throw new ConflictException(
        `You already asked ${dto.adminId ? skipped[0] : 'everyone'} about this in the last 24 hours`,
      );
    }

    const marketerName =
      (await this.prisma.user.findUnique({ where: { id: marketer.userId }, select: { name: true } }))?.name ??
      'A marketer';
    const title = `${marketerName} asks you to look at ${target.customer.name}'s ${dto.kind === 'LOAN' ? 'loan' : dto.kind === 'TOPUP' ? 'top-up' : 'asset request'}`;
    const message =
      `${target.what} is ${STAGE_TEXT[stage].toLowerCase()}.` + (dto.note ? ` Their note: "${dto.note}"` : '');
    await this.inapp.messageUsers(
      fresh.map((r) => r.userId),
      { title, message, callToActionUrl: target.link, subject },
    );

    // Email is best effort: the in-app prompt is what counts.
    const site = (process.env.FRONTEND_URL ?? 'https://microbuiltprime.com').replace(/\/+$/, '');
    for (const admin of fresh) {
      const to = visibleEmail(admin.email);
      if (!to) continue;
      try {
        await this.mail.sendCustomerNotification(to, {
          name: admin.name,
          title,
          message,
          ctaUrl: `${site}${target.link}`,
          ctaText: 'Open it',
        });
      } catch (error) {
        this.logger.error(`Escalation email to ${admin.userId} failed`, error instanceof Error ? error.stack : error);
        captureJobError(error, { job: 'marketer-escalation-email' });
      }
    }
    return { sentTo: fresh.map((r) => r.name), skipped, escalatedAt: now };
  }

  private async target(marketerId: string, kind: EscalationKind, id: string): Promise<EscalationTarget> {
    const borrower = { accountOfficerId: marketerId };
    const customer = { select: { userId: true, user: { select: { name: true } } } } as const;
    const who = (row: { userId: string; user: { name: string } }) => ({ id: row.userId, name: row.user.name });
    if (kind === 'LOAN') {
      const loan = await this.prisma.loan.findFirst({
        where: { id, borrower },
        select: { id: true, status: true, category: true, principal: true, borrower: customer },
      });
      if (!loan) throw new NotFoundException(LOAN_NOT_FOUND);
      return {
        stage: loanStage(loan.status),
        customer: who(loan.borrower),
        what: `${category(loan.category)} loan ${loan.id}${loan.principal.isZero() ? '' : ` of ${formatCurrency(toNumber(loan.principal))}`}`,
        link: ADMIN_LINKS.loan(loan.id),
      };
    }
    if (kind === 'TOPUP') {
      const topup = await this.prisma.microLoan.findFirst({
        where: { id, purpose: 'TOPUP', loan: { borrower } },
        select: { id: true, status: true, amount: true, loanId: true, loan: { select: { borrower: customer } } },
      });
      if (!topup) throw new NotFoundException(TOPUP_NOT_FOUND);
      return {
        stage: loanStage(topup.status),
        customer: who(topup.loan.borrower),
        what: `A top-up of ${formatCurrency(toNumber(topup.amount))} on loan ${topup.loanId}`,
        link: ADMIN_LINKS.topup(topup.id),
      };
    }
    const request = await this.prisma.commodityLoan.findFirst({
      where: { id, loan: { borrower } },
      select: {
        id: true,
        status: true,
        commodity: { select: { name: true } },
        microLoan: { select: { status: true } },
        loan: { select: { status: true, borrower: customer } },
      },
    });
    if (!request) throw new NotFoundException(ASSET_REQUEST_NOT_FOUND);
    return {
      stage: assetStage(request.status, request.loan.status, request.microLoan?.status ?? null),
      customer: who(request.loan.borrower),
      what: `The asset request for ${request.commodity.name}`,
      link: ADMIN_LINKS.assetRequest(request.id),
    };
  }

  private async lastEscalations(
    kind: EscalationKind,
    items: { id: string; stage: EscalationStage | null }[],
  ): Promise<Map<string, Date>> {
    const subjects = new Map<string, string>();
    for (const item of items) {
      if (item.stage) subjects.set(NOTIFICATION_SUBJECT.escalation(kind, item.id, item.stage), item.id);
    }
    const last = await this.lastBySubject([...subjects.keys()]);
    const byId = new Map<string, Date>();
    for (const [subject, at] of last) byId.set(subjects.get(subject)!, at);
    return byId;
  }

  /** When each subject was last sent to anyone. */
  private async lastBySubject(subjects: string[]): Promise<Map<string, Date>> {
    if (subjects.length === 0) return new Map();
    const rows = await this.prisma.notification.groupBy({
      by: ['subject'],
      where: { subject: { in: subjects } },
      _max: { createdAt: true },
    });
    return new Map(
      rows.flatMap((row) => (row.subject && row._max.createdAt ? [[row.subject, row._max.createdAt] as const] : [])),
    );
  }
}
