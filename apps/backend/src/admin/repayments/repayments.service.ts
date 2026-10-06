import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { comparePeriods, parseYm, periodLabel, toYm, visibleEmail, type Period } from '@microbuilt/shared';
import { Prisma, type PaymentInflowState, type PayrollPeriod } from '@prisma/client';
import { loanFiguresMany, parsePeriodRange, periodWhere } from 'src/common/dto';
import { LIQUIDATION_PROOFS_BUCKET } from 'src/common/types/repayment.interface';
import { formatCurrency } from 'src/common/utils';
import { AuthAccountsService } from 'src/auth/auth-accounts.service';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { loanBalances } from 'src/ledger/balances';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { ALREADY_DECIDED } from 'src/ledger/ledger.constants';
import { openExpected } from 'src/ledger/ledger.math';
import { LedgerService } from 'src/ledger/ledger.service';
import { LedgerTx, type Tx } from 'src/ledger/ledger.tx';
import { LiquidationsService } from 'src/ledger/liquidations.service';
import { money, toNumber, type Money } from 'src/ledger/money';
import { lagosMonthOf } from 'src/ledger/period';
import { PeriodCloseService } from 'src/ledger/period-close.service';
import { PeriodsService } from 'src/ledger/periods.service';
import { VARIATIONS_BUCKET, VariationService, type VariationFilter } from 'src/ledger/variation.service';
import { ADMIN_LINKS, AdminNotifierService } from 'src/notifications/admin-notifier.service';
import { CUSTOMER_LINKS, CustomerNotifierService } from 'src/notifications/customer-notifier.service';
import { MailService } from 'src/notifications/mail.service';
import { QueueProducer } from 'src/queue/bull/queue.producer';
import type {
  FilterAppliedRepaymentsDto,
  FilterDeductionsDto,
  FilterRepaymentsDto,
  ManualRepaymentResolutionDto,
} from '../common/dto/repayment.dto';
import type {
  AppliedRepaymentListItemDto,
  DeductionDetailDto,
  DeductionListItemDto,
  LiquidationDecisionResultDto,
  ManualResolutionResultDto,
  PeriodCloseSummaryDto,
  RepaymentDetailDto,
  RepaymentListItemDto,
  RepaymentOverviewDto,
  SignedFileUrlDto,
  VariationDraftQueuedDto,
  VariationPreviewDto,
  VariationRevertResultDto,
  VariationSubmitResultDto,
} from '../common/entities/repayment.entity';
import { buildAppliedWhere, buildDeductionWhere, buildInflowWhere } from './repayment-filters';

/** Seconds a liquidation proof link stays valid. */
export const PROOF_URL_TTL = 5 * 60;
/** Seconds a submitted variation file link stays valid. */
export const VARIATION_FILE_URL_TTL = 10 * 60;

const RESOLVABLE: PaymentInflowState[] = ['UNMATCHED', 'REVIEWING'];

interface OverviewRow {
  expected: Prisma.Decimal;
  collected: Prisma.Decimal;
  underpaidAmount: Prisma.Decimal;
  underpaidCount: number;
  failedAmount: Prisma.Decimal;
  failedCount: number;
}

interface MoneyInRow {
  payroll: Prisma.Decimal;
  liquidation: Prisma.Decimal;
  imported: Prisma.Decimal;
  receivedCount: number;
  appliedAmount: Prisma.Decimal;
  appliedCount: number;
  principal: Prisma.Decimal;
  interest: Prisma.Decimal;
  penalty: Prisma.Decimal;
}

interface Resolution {
  result: ManualResolutionResultDto;
  /** Set when money reached a loan, so the customer is told after commit. */
  notify?: { customerId: string; label: string; applied: Money; unapplied: Money };
}

const naira = (value: Prisma.Decimal.Value) => formatCurrency(toNumber(value));

// /admin/repayments (everything but upload/validate, which are PayrollUploadService's) and
// /admin/payroll-variations. Money moves only through the ledger: allocatePayment, the
// liquidation decision, the period close and the variation submit.
@Injectable()
export class RepaymentsService {
  private readonly logger = new Logger(RepaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
    private readonly liquidations: LiquidationsService,
    private readonly periodClose: PeriodCloseService,
    private readonly periods: PeriodsService,
    private readonly variations: VariationService,
    private readonly supabase: SupabaseService,
    private readonly queue: QueueProducer,
    private readonly notifier: CustomerNotifierService,
    private readonly clock: LedgerClock,
    private readonly accounts: AuthAccountsService,
    private readonly adminNotifier: AdminNotifierService,
    private readonly mail: MailService,
  ) {}

  // ── Overview ──────────────────────────────────────────────────────────────

  /**
   * Deductions sent to payroll for `from..to` (default: the current Lagos month), aggregated in
   * SQL. OPEN deductions haven't been asked for yet, so they don't count.
   */
  async overview(query: { from?: string; to?: string }): Promise<RepaymentOverviewDto> {
    const current = lagosMonthOf(this.clock.now());
    const range = parsePeriodRange(query);
    const to = range.to ?? current;
    const from = range.from ?? (range.to ?? current);
    if (comparePeriods(from, to) > 0) throw new BadRequestException('`from` must not be after `to`');

    const periods = await this.prisma.payrollPeriod.findMany({
      where: periodWhere({ from, to }),
      select: { id: true },
    });
    const ids = periods.map((p) => p.id);
    const [row] = ids.length
      ? await this.prisma.$queryRaw<OverviewRow[]>`
          SELECT COALESCE(SUM(d."expected"), 0) AS "expected",
                 COALESCE(SUM(r."paid"), 0) AS "collected",
                 COALESCE(SUM(GREATEST(d."expected" - r."paid", 0)) FILTER (WHERE d."status" = 'PARTIAL'), 0)
                   AS "underpaidAmount",
                 (COUNT(*) FILTER (WHERE d."status" = 'PARTIAL'))::int AS "underpaidCount",
                 COALESCE(SUM(GREATEST(d."expected" - r."paid", 0)) FILTER (WHERE d."status" = 'FAILED'), 0)
                   AS "failedAmount",
                 (COUNT(*) FILTER (WHERE d."status" = 'FAILED'))::int AS "failedCount"
          FROM "Deduction" d
          CROSS JOIN LATERAL (
            SELECT COALESCE(SUM(rp."amount"), 0) AS "paid" FROM "Repayment" rp WHERE rp."deductionId" = d."id"
          ) r
          WHERE d."periodId" IN (${Prisma.join(ids)}) AND d."status" <> 'OPEN'`
      : [];
    const awaiting = await this.prisma.deduction.aggregate({
      where: { status: 'AWAITING', period: { year: current.year, month: current.month } },
      _sum: { expected: true },
    });
    // Money in, whatever deduction (if any) it settled: inflows for these months and the repayments made from them.
    const [moneyIn] = ids.length
      ? await this.prisma.$queryRaw<MoneyInRow[]>`
          SELECT COALESCE(SUM(i."amount") FILTER (WHERE i."source" = 'PAYROLL'), 0) AS "payroll",
                 COALESCE(SUM(i."amount") FILTER (WHERE i."source" = 'LIQUIDATION'), 0) AS "liquidation",
                 COALESCE(SUM(i."amount") FILTER (WHERE i."source" = 'IMPORT'), 0) AS "imported",
                 COUNT(*)::int AS "receivedCount",
                 COALESCE(SUM(r."amount"), 0) AS "appliedAmount",
                 COUNT(r."id")::int AS "appliedCount",
                 COALESCE(SUM(b."principal"), 0) AS "principal",
                 COALESCE(SUM(b."interest"), 0) AS "interest",
                 COALESCE(SUM(b."penalty"), 0) AS "penalty"
          FROM "PaymentInflow" i
          LEFT JOIN "Repayment" r ON r."paymentInflowId" = i."id"
          LEFT JOIN LATERAL (
            SELECT SUM(x."amount") FILTER (WHERE x."component" = 'PRINCIPAL') AS "principal",
                   SUM(x."amount") FILTER (WHERE x."component" = 'INTEREST') AS "interest",
                   SUM(x."amount") FILTER (WHERE x."component" = 'PENALTY') AS "penalty"
            FROM "RepaymentBreakdown" x WHERE x."repaymentId" = r."id"
          ) b ON TRUE
          WHERE i."periodId" IN (${Prisma.join(ids)}) AND i."state" <> 'REJECTED'`
      : [];
    const unresolved = await this.prisma.paymentInflow.aggregate({
      where: { state: { in: ['UNMATCHED', 'AWAITING', 'REVIEWING'] } },
      _sum: { amount: true },
      _count: true,
    });
    const payroll = money(moneyIn?.payroll ?? 0);
    const liquidation = money(moneyIn?.liquidation ?? 0);
    const imported = money(moneyIn?.imported ?? 0);

    const underpaid = money(row?.underpaidAmount ?? 0);
    const failed = money(row?.failedAmount ?? 0);
    return {
      from: periodLabel(from),
      to: periodLabel(to),
      expected: toNumber(row?.expected ?? 0),
      collected: toNumber(row?.collected ?? 0),
      overdue: toNumber(underpaid.plus(failed)),
      underpaid: { amount: toNumber(underpaid), count: Number(row?.underpaidCount ?? 0) },
      failed: { amount: toNumber(failed), count: Number(row?.failedCount ?? 0) },
      currentPeriod: periodLabel(current),
      expectingThisPeriod: toNumber(awaiting._sum.expected ?? 0),
      received: {
        amount: toNumber(payroll.plus(liquidation).plus(imported)),
        count: Number(moneyIn?.receivedCount ?? 0),
        bySource: { PAYROLL: toNumber(payroll), LIQUIDATION: toNumber(liquidation), IMPORT: toNumber(imported) },
      },
      applied: {
        amount: toNumber(moneyIn?.appliedAmount ?? 0),
        count: Number(moneyIn?.appliedCount ?? 0),
        principal: toNumber(moneyIn?.principal ?? 0),
        interest: toNumber(moneyIn?.interest ?? 0),
        penalty: toNumber(moneyIn?.penalty ?? 0),
      },
      unresolved: { amount: toNumber(unresolved._sum.amount ?? 0), count: unresolved._count },
    };
  }

  // ── List and detail ───────────────────────────────────────────────────────

  async list(dto: FilterRepaymentsDto): Promise<{ rows: RepaymentListItemDto[]; total: number }> {
    const { page = 1, limit = 20 } = dto;
    const where = buildInflowWhere(dto);
    const [inflows, total] = await Promise.all([
      this.prisma.paymentInflow.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          source: true,
          state: true,
          amount: true,
          externalUserId: true,
          uploadId: true,
          proofPath: true,
          createdAt: true,
          period: { select: { year: true, month: true } },
          customer: { select: { userId: true, externalId: true, user: { select: { name: true } } } },
          repayment: { select: { amount: true } },
        },
      }),
      this.prisma.paymentInflow.count({ where }),
    ]);

    const rows = inflows.map((inflow) => ({
      id: inflow.id,
      source: inflow.source,
      state: inflow.state,
      amount: toNumber(inflow.amount),
      applied: toNumber(inflow.repayment?.amount ?? 0),
      period: periodLabel(inflow.period),
      customer: inflow.customer
        ? { id: inflow.customer.userId, name: inflow.customer.user.name, externalId: inflow.customer.externalId }
        : null,
      externalUserId: inflow.externalUserId,
      uploadId: inflow.uploadId,
      hasProof: Boolean(inflow.proofPath),
      createdAt: inflow.createdAt,
    }));
    return { rows, total };
  }

  /** What each loan is expected to pay per payroll month, with what has been applied to it. */
  async listDeductions(dto: FilterDeductionsDto): Promise<{ rows: DeductionListItemDto[]; total: number }> {
    const { page = 1, limit = 20 } = dto;
    const where = buildDeductionWhere(dto);
    const [deductions, total] = await Promise.all([
      this.prisma.deduction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }, { id: 'desc' }],
        select: {
          id: true,
          loanId: true,
          expected: true,
          status: true,
          settledAt: true,
          penalizedAt: true,
          period: { select: { year: true, month: true } },
          repayments: { select: { amount: true } },
          loan: {
            select: { borrower: { select: { userId: true, externalId: true, user: { select: { name: true } } } } },
          },
        },
      }),
      this.prisma.deduction.count({ where }),
    ]);

    const rows = deductions.map((deduction) => {
      const paid = deduction.repayments.reduce((sum, r) => sum.plus(r.amount), money(0));
      const owing = money(deduction.expected.minus(paid));
      const borrower = deduction.loan.borrower;
      return {
        id: deduction.id,
        loanId: deduction.loanId,
        period: { ym: toYm(deduction.period), label: periodLabel(deduction.period) },
        customer: { id: borrower.userId, name: borrower.user.name, externalId: borrower.externalId },
        expected: toNumber(deduction.expected),
        paid: toNumber(paid),
        outstanding: toNumber(owing.isNegative() ? money(0) : owing),
        status: deduction.status,
        settledAt: deduction.settledAt,
        penalizedAt: deduction.penalizedAt,
      };
    });
    return { rows, total };
  }

  /**
   * One deduction with the payments applied to it and, while it is OPEN, the live calculation of its amount
   * (the same `openExpected` the ledger uses). A frozen deduction keeps the amount payroll was sent.
   */
  async deductionDetail(id: string): Promise<DeductionDetailDto> {
    const deduction = await this.prisma.deduction.findUnique({
      where: { id },
      select: {
        id: true,
        loanId: true,
        expected: true,
        status: true,
        settledAt: true,
        penalizedAt: true,
        createdAt: true,
        period: { select: { year: true, month: true } },
        repayments: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            amount: true,
            createdAt: true,
            paymentInflowId: true,
            paymentInflow: { select: { source: true } },
            breakdown: { select: { component: true, amount: true } },
          },
        },
        loan: {
          select: { borrower: { select: { userId: true, externalId: true, user: { select: { name: true } } } } },
        },
      },
    });
    if (!deduction) throw new NotFoundException('Deduction not found');

    const paid = deduction.repayments.reduce((sum, r) => sum.plus(r.amount), money(0));
    const owing = money(deduction.expected.minus(paid));
    const borrower = deduction.loan.borrower;

    let calculation: DeductionDetailDto['calculation'] = null;
    if (deduction.status === 'OPEN') {
      const b = await loanBalances(this.prisma, deduction.loanId);
      const stopped = b.status !== 'DISBURSED';
      const toSpread = Prisma.Decimal.max(0, b.outstanding.minus(b.committed));
      calculation = {
        owed: toNumber(b.owed),
        repaid: toNumber(b.repaid),
        outstanding: toNumber(b.outstanding),
        committed: toNumber(b.committed),
        toSpread: toNumber(money(toSpread)),
        tenure: b.tenure,
        monthsSent: b.frozenCount,
        remainingMonths: b.remainingMonths,
        amount: stopped ? 0 : toNumber(openExpected(b.outstanding, b.committed, b.remainingMonths, b.lastSent)),
        stopped,
      };
    }

    return {
      id: deduction.id,
      loanId: deduction.loanId,
      period: { ym: toYm(deduction.period), label: periodLabel(deduction.period) },
      customer: { id: borrower.userId, name: borrower.user.name, externalId: borrower.externalId },
      expected: toNumber(deduction.expected),
      paid: toNumber(paid),
      outstanding: toNumber(owing.isNegative() ? money(0) : owing),
      status: deduction.status,
      settledAt: deduction.settledAt,
      penalizedAt: deduction.penalizedAt,
      createdAt: deduction.createdAt,
      payments: deduction.repayments.map((r) => {
        const part = (component: string) => toNumber(r.breakdown.find((x) => x.component === component)?.amount ?? 0);
        return {
          id: r.id,
          paymentInflowId: r.paymentInflowId,
          source: r.paymentInflow.source,
          amount: toNumber(r.amount),
          principal: part('PRINCIPAL'),
          interest: part('INTEREST'),
          penalty: part('PENALTY'),
          createdAt: r.createdAt,
        };
      }),
      calculation,
    };
  }

  /** Payments applied to loans (Repayment rows), newest first, split into principal, interest and penalty. */
  async listApplied(dto: FilterAppliedRepaymentsDto): Promise<{ rows: AppliedRepaymentListItemDto[]; total: number }> {
    const { page = 1, limit = 20 } = dto;
    const where = buildAppliedWhere(dto);
    const [repayments, total] = await Promise.all([
      this.prisma.repayment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          loanId: true,
          paymentInflowId: true,
          deductionId: true,
          amount: true,
          createdAt: true,
          breakdown: { select: { component: true, amount: true } },
          paymentInflow: { select: { source: true, period: { select: { year: true, month: true } } } },
          loan: {
            select: { borrower: { select: { userId: true, externalId: true, user: { select: { name: true } } } } },
          },
        },
      }),
      this.prisma.repayment.count({ where }),
    ]);

    const rows = repayments.map((repayment) => {
      const part = (component: string) =>
        toNumber(repayment.breakdown.find((b) => b.component === component)?.amount ?? 0);
      const borrower = repayment.loan.borrower;
      const period = repayment.paymentInflow.period;
      return {
        id: repayment.id,
        loanId: repayment.loanId,
        paymentInflowId: repayment.paymentInflowId,
        source: repayment.paymentInflow.source,
        period: { ym: toYm(period), label: periodLabel(period) },
        customer: { id: borrower.userId, name: borrower.user.name, externalId: borrower.externalId },
        amount: toNumber(repayment.amount),
        principal: part('PRINCIPAL'),
        interest: part('INTEREST'),
        penalty: part('PENALTY'),
        deductionId: repayment.deductionId,
        createdAt: repayment.createdAt,
      };
    });
    return { rows, total };
  }

  async detail(id: string): Promise<RepaymentDetailDto> {
    const inflow = await this.prisma.paymentInflow.findUnique({
      where: { id },
      select: {
        id: true,
        source: true,
        state: true,
        amount: true,
        externalUserId: true,
        uploadId: true,
        proofPath: true,
        createdAt: true,
        customerId: true,
        periodId: true,
        period: { select: { year: true, month: true } },
        customer: {
          select: {
            userId: true,
            externalId: true,
            user: { select: { name: true, email: true, phoneNumber: true } },
          },
        },
        repayment: {
          select: {
            id: true,
            loanId: true,
            amount: true,
            createdAt: true,
            deductionId: true,
            breakdown: { select: { component: true, amount: true } },
          },
        },
      },
    });
    if (!inflow) throw new NotFoundException('Payment not found');

    const loan = await this.loanFor(inflow.repayment?.loanId ?? null, inflow.customerId);
    const deduction = await this.deductionFor(inflow.repayment?.deductionId ?? null, loan?.id ?? null, inflow);
    const [figures, history] = await Promise.all([
      loan ? loanFiguresMany(this.prisma, [loan]) : Promise.resolve(null),
      this.prisma.auditLog.findMany({
        where: { entityType: 'PAYMENT_INFLOW', entityId: id },
        orderBy: { createdAt: 'asc' },
        select: { action: true, note: true, actorId: true, createdAt: true, actor: { select: { user: { select: { name: true } } } } },
      }),
    ]);

    const applied = money(inflow.repayment?.amount ?? 0);
    const part = (component: string) =>
      toNumber(inflow.repayment?.breakdown.find((b) => b.component === component)?.amount ?? 0);
    const customer = inflow.customer;
    return {
      id: inflow.id,
      source: inflow.source,
      state: inflow.state,
      amount: toNumber(inflow.amount),
      applied: toNumber(applied),
      unapplied: toNumber(money(inflow.amount.minus(applied))),
      period: periodLabel(inflow.period),
      externalUserId: inflow.externalUserId,
      uploadId: inflow.uploadId,
      hasProof: Boolean(inflow.proofPath),
      createdAt: inflow.createdAt,
      customer: customer
        ? {
            id: customer.userId,
            name: customer.user.name,
            externalId: customer.externalId,
            email: visibleEmail(customer.user.email),
            phoneNumber: customer.user.phoneNumber,
          }
        : null,
      repayment: inflow.repayment
        ? {
            id: inflow.repayment.id,
            loanId: inflow.repayment.loanId,
            amount: toNumber(inflow.repayment.amount),
            principal: part('PRINCIPAL'),
            interest: part('INTEREST'),
            penalty: part('PENALTY'),
            createdAt: inflow.repayment.createdAt,
          }
        : null,
      deduction,
      loan:
        loan && figures
          ? { id: loan.id, category: loan.category, status: loan.status, ...figures.get(loan.id)! }
          : null,
      history: history.map((entry) => ({
        action: entry.action,
        note: entry.note,
        actorId: entry.actorId,
        actorName: entry.actor?.user?.name ?? null,
        createdAt: entry.createdAt,
      })),
    };
  }

  /** The loan paid into; else the customer's live loan; else their latest one. */
  private async loanFor(loanId: string | null, customerId: string | null) {
    const select = { id: true, category: true, status: true, principal: true, tenure: true } as const;
    if (loanId) return this.prisma.loan.findUnique({ where: { id: loanId }, select });
    if (!customerId) return null;
    return (
      (await this.prisma.loan.findFirst({ where: { borrowerId: customerId, status: 'DISBURSED' }, select })) ??
      (await this.prisma.loan.findFirst({ where: { borrowerId: customerId }, orderBy: { createdAt: 'desc' }, select }))
    );
  }

  /** The deduction the payment settled; or, for a payroll row not applied yet, the loan's deduction that month. */
  private async deductionFor(
    settledId: string | null,
    loanId: string | null,
    inflow: { source: string; periodId: string },
  ): Promise<RepaymentDetailDto['deduction']> {
    const select = {
      id: true,
      expected: true,
      status: true,
      period: { select: { year: true, month: true } },
    } as const;
    const deduction = settledId
      ? await this.prisma.deduction.findUnique({ where: { id: settledId }, select })
      : loanId && inflow.source === 'PAYROLL'
        ? await this.prisma.deduction.findUnique({
            where: { loanId_periodId: { loanId, periodId: inflow.periodId } },
            select,
          })
        : null;
    if (!deduction) return null;
    const paid = await this.prisma.repayment.aggregate({ where: { deductionId: deduction.id }, _sum: { amount: true } });
    return {
      id: deduction.id,
      period: periodLabel(deduction.period),
      expected: toNumber(deduction.expected),
      paid: toNumber(paid._sum.amount ?? 0),
      status: deduction.status,
      settledByThis: Boolean(settledId),
    };
  }

  // ── Decisions ─────────────────────────────────────────────────────────────

  /**
   * An UNMATCHED or REVIEWING payroll payment: APPLY it to a customer's live loan (settling that
   * month's deduction when one is due), SETTLE an overpayment once the excess is refunded, or
   * REJECT it. Compare-and-swap on the state: a second admin gets 409.
   */
  async resolve(id: string, dto: ManualRepaymentResolutionDto, actorId: string): Promise<ManualResolutionResultDto> {
    const { result, notify } = await this.ledgerTx.transaction<Resolution>(async (tx) => {
      const inflow = await tx.paymentInflow.findUnique({
        where: { id },
        select: {
          id: true,
          source: true,
          state: true,
          amount: true,
          customerId: true,
          periodId: true,
          period: { select: { year: true, month: true } },
          repayment: { select: { loanId: true, amount: true } },
        },
      });
      if (!inflow) throw new NotFoundException('Payment not found');
      if (inflow.source !== 'PAYROLL') {
        throw new BadRequestException('Liquidations are accepted or rejected, not resolved here');
      }
      if (!RESOLVABLE.includes(inflow.state)) {
        throw new ConflictException(`This payment is already ${inflow.state.toLowerCase()}`);
      }
      const note = dto.note?.trim() || undefined;

      if (dto.action === 'SETTLE') {
        if (!inflow.repayment) {
          throw new ConflictException('Nothing from this payment has been applied yet: apply it to a customer or reject it');
        }
        await this.swapState(tx, id, inflow.state, { state: 'SETTLED' });
        const applied = money(inflow.repayment.amount);
        const refund = money(inflow.amount.minus(applied));
        await this.ledgerTx.audit(tx, {
          actorId,
          action: 'PAYMENT_INFLOW_APPROVED',
          entityType: 'PAYMENT_INFLOW',
          entityId: id,
          note: `Settled; ${naira(refund)} paid beyond what was owed refunded${note ? `: ${note}` : ''}`,
        });
        return {
          result: {
            id,
            state: 'SETTLED',
            customerId: inflow.customerId,
            loanId: inflow.repayment.loanId,
            applied: toNumber(applied),
            unapplied: toNumber(refund),
            deductionStatus: null,
          },
        };
      }

      if (inflow.repayment) {
        throw new ConflictException(
          'Part of this payment is already applied to a loan: refund the rest, then settle it',
        );
      }

      if (dto.action === 'REJECT') {
        await this.swapState(tx, id, inflow.state, { state: 'REJECTED' });
        await this.ledgerTx.audit(tx, {
          actorId,
          action: 'PAYMENT_INFLOW_REJECTED',
          entityType: 'PAYMENT_INFLOW',
          entityId: id,
          note,
        });
        return {
          result: {
            id,
            state: 'REJECTED',
            customerId: inflow.customerId,
            loanId: null,
            applied: 0,
            unapplied: toNumber(inflow.amount),
            deductionStatus: null,
          },
        };
      }

      // APPLY
      const customerId = dto.customerId as string;
      const customer = await tx.customer.findUnique({ where: { userId: customerId }, select: { userId: true } });
      if (!customer) throw new NotFoundException('Customer not found');
      const loan = await tx.loan.findFirst({
        where: { borrowerId: customerId, status: 'DISBURSED' },
        select: { id: true },
      });
      if (!loan) throw new ConflictException('This customer has no active loan');
      await this.swapState(tx, id, inflow.state, { customerId });

      const deduction = await tx.deduction.findFirst({
        where: { loanId: loan.id, periodId: inflow.periodId, status: { in: ['AWAITING', 'PARTIAL'] } },
        select: { id: true },
      });
      const allocation = await this.ledger.allocatePayment(
        { loanId: loan.id, amount: inflow.amount, inflowId: id, deductionId: deduction?.id },
        tx,
      );
      const state: PaymentInflowState = allocation.unapplied.gt(0) ? 'REVIEWING' : 'SETTLED';
      await tx.paymentInflow.update({ where: { id }, data: { state } });

      const label = periodLabel(inflow.period);
      const parts = [
        `Applied ${naira(allocation.applied)} to loan ${loan.id}${deduction ? ` (${label} deduction)` : ''}`,
        ...(allocation.unapplied.gt(0) ? [`${naira(allocation.unapplied)} more than owed to refund`] : []),
      ];
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'PAYMENT_INFLOW_APPROVED',
        entityType: 'PAYMENT_INFLOW',
        entityId: id,
        note: `${parts.join('; ')}${note ? `: ${note}` : ''}`,
      });
      return {
        result: {
          id,
          state,
          customerId,
          loanId: loan.id,
          applied: toNumber(allocation.applied),
          unapplied: toNumber(allocation.unapplied),
          deductionStatus: allocation.deductionStatus,
        },
        notify: allocation.applied.gt(0)
          ? { customerId, label, applied: allocation.applied, unapplied: allocation.unapplied }
          : undefined,
      };
    });

    if (notify) await this.tellCustomer(notify);
    return result;
  }

  private async swapState(
    tx: Tx,
    id: string,
    expected: PaymentInflowState,
    data: Prisma.PaymentInflowUpdateManyMutationInput & { customerId?: string },
  ): Promise<void> {
    const { count } = await tx.paymentInflow.updateMany({ where: { id, state: expected }, data });
    if (count === 0) throw new ConflictException(ALREADY_DECIDED);
  }

  /** After commit, as the payroll consumer does. The notifier never throws. */
  private async tellCustomer(n: NonNullable<Resolution['notify']>): Promise<void> {
    const extra = n.unapplied.gt(0)
      ? ` ${naira(n.unapplied)} more than you owed was deducted; we will contact you about a refund.`
      : '';
    await this.notifier.notify(n.customerId, {
      title: 'Repayment Received',
      message: `Your repayment of ${naira(n.applied)} for ${n.label} has been received and applied to your loan. Thank you.${extra}`,
      ctaUrl: CUSTOMER_LINKS.repayments,
    });
  }

  async decideLiquidation(
    id: string,
    approve: boolean,
    actorId: string,
    note?: string,
  ): Promise<LiquidationDecisionResultDto> {
    const { inflow, allocation } = await this.liquidations.decide(
      id,
      approve ? { approve: true } : { approve: false, note: note?.trim() || undefined },
      actorId,
    );
    return {
      id: inflow.id,
      customerId: inflow.customerId as string,
      state: inflow.state,
      amount: toNumber(inflow.amount),
      applied: allocation ? toNumber(allocation.applied) : null,
      outstanding: allocation ? toNumber(allocation.outstanding) : null,
    };
  }

  async proofUrl(id: string): Promise<SignedFileUrlDto> {
    const inflow = await this.prisma.paymentInflow.findUnique({ where: { id }, select: { proofPath: true } });
    if (!inflow) throw new NotFoundException('Payment not found');
    if (!inflow.proofPath) throw new NotFoundException('This payment has no proof attached');
    const url = await this.supabase.signedUrl(LIQUIDATION_PROOFS_BUCKET, inflow.proofPath, PROOF_URL_TTL);
    return { url, expiresIn: PROOF_URL_TTL };
  }

  async closePeriod(ym: string, actorId: string): Promise<PeriodCloseSummaryDto> {
    const period = await this.periodFor(ym);
    return this.periodClose.close(period.id, actorId);
  }

  // ── Payroll variations ────────────────────────────────────────────────────

  /**
   * The month the next variation is for: the earliest one holding OPEN deductions (they all sit in the first month
   * not yet generated). With none open, the first month from now that hasn't been generated.
   */
  async openVariationPeriod(): Promise<{ ym: string; label: string }> {
    const open = await this.prisma.deduction.findFirst({
      where: { status: 'OPEN' },
      orderBy: [{ period: { year: 'asc' } }, { period: { month: 'asc' } }],
      select: { period: { select: { year: true, month: true } } },
    });
    const period = open?.period ?? (await this.periods.firstUnsubmittedFrom(this.clock.now()));
    return { ym: toYm(period), label: periodLabel(period) };
  }

  async variationPreview(ym: string, filter: VariationFilter): Promise<VariationPreviewDto> {
    const period = await this.periodFor(ym);
    const preview = await this.variations.preview(period.id, filter);
    const { filePath, ...state } = preview.period;
    return {
      period: { ...state, hasFile: Boolean(filePath) },
      rows: preview.rows.map((row) => ({ ...row, balance: toNumber(row.balance), amount: toNumber(row.amount) })),
      counts: preview.counts,
    };
  }

  /** Queues a draft of the month's file to `email` (sub D's reports consumer builds and mails it). */
  async generateVariationDraft(
    ym: string,
    email: string | null | undefined,
    requestedById: string,
  ): Promise<VariationDraftQueuedDto> {
    if (!email) throw new BadRequestException('Add an email address to your account to receive drafts');
    const period = await this.periodFor(ym);
    const label = periodLabel(period);
    if (period.variationSubmittedAt) {
      throw new ConflictException(`${label} has already been submitted: download its file instead`);
    }
    try {
      await this.queue.generateVariationDraft({ periodId: period.id, email, requestedById });
    } catch (error) {
      this.logger.error(`Queueing the ${label} variation draft failed`, error instanceof Error ? error.stack : error);
      throw new ServiceUnavailableException('The draft could not be queued. Try again.');
    }
    return { period: label, email };
  }

  async submitVariation(ym: string, actorId: string): Promise<VariationSubmitResultDto> {
    const period = await this.periodFor(ym);
    const submitted = await this.variations.submit(period.id, actorId);
    void this.announceVariation(actorId, (by) => ({
      title: `${submitted.label} variation generated`,
      message: `${by} generated the ${submitted.label} payroll variation: ${submitted.rows} changes totalling ${naira(submitted.amount)}. The file is in your email and in the variation dialog.`,
      file: { path: submitted.filePath, rows: submitted.rows, amount: toNumber(submitted.amount) },
      period: submitted.label,
    }));
    return {
      periodId: submitted.periodId,
      period: submitted.label,
      counts: submitted.counts,
      frozen: submitted.frozen,
      opened: submitted.opened,
    };
  }

  /** Undoes a submission made by mistake, once the super admin's authenticator code checks out. */
  async revertVariation(ym: string, code: string, reason: string, actorId: string): Promise<VariationRevertResultDto> {
    await this.accounts.assertTwoFactorCode(actorId, code);
    const period = await this.periodFor(ym);
    const reverted = await this.variations.revert(period.id, actorId, reason);
    if (reverted.filePath) {
      // The stored file described the reverted submission; generating again writes a new one.
      await this.supabase.removePrivate(VARIATIONS_BUCKET, reverted.filePath).catch((error: unknown) => {
        this.logger.warn(`Removing ${reverted.filePath} failed: ${error instanceof Error ? error.message : error}`);
      });
    }
    void this.announceVariation(actorId, (by) => ({
      title: `${reverted.label} variation reverted`,
      message: `${by} reverted the ${reverted.label} payroll variation: "${reason}". Its ${reverted.reopened} deductions are open again; the file sent earlier is void, so don't send it to payroll.`,
      period: reverted.label,
    }));
    return { periodId: reverted.periodId, period: reverted.label, reopened: reverted.reopened, removed: reverted.removed };
  }

  /**
   * Tells every super admin (in-app and by email) that a variation was generated or reverted. A generated one's email
   * carries the file. Best effort: the variation itself is already done, so a failure is logged, never thrown.
   */
  private async announceVariation(
    actorId: string,
    build: (by: string) => {
      title: string;
      message: string;
      period: string;
      file?: { path: string; rows: number; amount: number };
    },
  ): Promise<void> {
    try {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
      const notice = build(actor?.name ?? 'A super admin');
      await this.adminNotifier.notifyAdmins(['SUPER_ADMIN'], {
        title: notice.title,
        message: notice.message,
        ctaUrl: ADMIN_LINKS.payrollVariation,
      });
      const admins = await this.prisma.admin.findMany({
        where: { role: 'SUPER_ADMIN', user: { status: 'ACTIVE' } },
        select: { user: { select: { email: true, name: true } } },
      });
      const recipients = admins.flatMap(({ user }) => {
        const email = visibleEmail(user.email);
        return email ? [{ email, name: user.name }] : [];
      });
      const file = notice.file ? await this.supabase.downloadPrivate(VARIATIONS_BUCKET, notice.file.path) : null;
      for (const recipient of recipients) {
        try {
          if (file && notice.file) {
            await this.mail.sendLoanScheduleReport(
              recipient.email,
              { period: notice.period, len: notice.file.rows, amount: notice.file.amount, submittedBy: actor?.name },
              file,
            );
          } else {
            await this.mail.sendCustomerNotification(recipient.email, {
              name: recipient.name,
              title: notice.title,
              message: notice.message,
              ctaUrl: `${(process.env.FRONTEND_URL ?? 'https://microbuiltprime.com').replace(/\/+$/, '')}${ADMIN_LINKS.payrollVariation}`,
              ctaText: 'Open the variation',
            });
          }
        } catch (error) {
          this.logger.warn(`Emailing ${notice.title} failed: ${error instanceof Error ? error.message : error}`);
        }
      }
    } catch (error) {
      this.logger.error('Announcing a variation failed', error instanceof Error ? error.stack : error);
    }
  }

  async variationFileUrl(ym: string): Promise<SignedFileUrlDto> {
    const period = await this.periodFor(ym);
    if (!period.variationFilePath) {
      throw new NotFoundException(`The ${periodLabel(period)} variation hasn't been submitted yet`);
    }
    const url = await this.supabase.signedUrl(
      VARIATIONS_BUCKET,
      period.variationFilePath,
      VARIATION_FILE_URL_TTL,
      `variation-${toYm(period)}.xlsx`,
    );
    return { url, expiresIn: VARIATION_FILE_URL_TTL };
  }

  private periodFor(ym: string): Promise<PayrollPeriod> {
    const period: Period = parseYm(ym);
    return this.periods.ensure(period);
  }
}
