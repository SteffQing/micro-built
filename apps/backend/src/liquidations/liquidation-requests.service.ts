import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { nextPeriod, periodLabel, type Period } from '@microbuilt/shared';
import type { PaymentInflowState, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { captureJobError } from 'src/common/observability';
import { proofType } from 'src/common/logic/proof-file';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { loanBalances } from 'src/ledger/balances';
import { LiquidationsService } from 'src/ledger/liquidations.service';
import { money, toNumber } from 'src/ledger/money';
import { AdminNotifierService, NOTIFICATION_SUBJECT } from 'src/notifications/admin-notifier.service';
import { formatCurrency } from 'src/common/utils';
import { LIQUIDATION_PROOFS_BUCKET } from 'src/common/types/repayment.interface';

/** Proofs open through links this short-lived (V2.MD Stage 6). */
export const PROOF_LINK_SECONDS = 5 * 60;

export interface LiquidationPreview {
  loanId: string;
  owed: number;
  repaid: number;
  outstanding: number;
  penaltyOutstanding: number;
  interestOutstanding: number;
  principalOutstanding: number;
  remainingMonths: number;
  monthly: number | null;
  /** The last payroll month deductions run to at the current pace, e.g. "MARCH 2027". */
  endPeriod: string | null;
}

export interface LiquidationHistoryItem {
  id: string;
  amount: number;
  state: PaymentInflowState;
  requestedAt: Date;
  decidedAt: Date | null;
  /** A rejection's reason. */
  note: string | null;
  hasProof: boolean;
}

function addMonths(period: Period, months: number): Period {
  let result = period;
  for (let i = 0; i < months; i++) result = nextPeriod(result);
  return result;
}

// Paying off some or all of a loan outside payroll (V2.MD §0.4-4/6, Stage 6): the customer, or an
// admin for them, sends the amount with proof; a super admin approves it (ledger), which applies
// it at once by the ratio method.
@Injectable()
export class LiquidationRequestsService {
  private readonly logger = new Logger(LiquidationRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly liquidations: LiquidationsService,
    private readonly adminNotifier: AdminNotifierService,
  ) {}

  async preview(customerId: string): Promise<LiquidationPreview> {
    const loan = await this.prisma.loan.findFirst({
      where: { borrowerId: customerId, status: 'DISBURSED' },
      select: { id: true },
    });
    if (!loan) throw new ConflictException('There is no active loan to liquidate');
    const [balances, open] = await Promise.all([
      loanBalances(this.prisma, loan.id),
      this.prisma.deduction.findFirst({
        where: { loanId: loan.id, status: 'OPEN' },
        select: { expected: true, period: { select: { year: true, month: true } } },
      }),
    ]);
    const left = (part: 'principal' | 'interest' | 'penalty') =>
      toNumber(money(balances.booked[part].minus(balances.collected[part])));
    return {
      loanId: loan.id,
      owed: toNumber(balances.owed),
      repaid: toNumber(balances.repaid),
      outstanding: toNumber(balances.outstanding),
      penaltyOutstanding: left('penalty'),
      interestOutstanding: left('interest'),
      principalOutstanding: left('principal'),
      remainingMonths: balances.remainingMonths,
      monthly: open ? toNumber(open.expected) : null,
      endPeriod: open ? periodLabel(addMonths(open.period, balances.remainingMonths - 1)) : null,
    };
  }

  /**
   * Stores the proof privately as `<customerId>/<inflowId>.<ext>`, then records the request; if
   * recording fails the file is removed again.
   */
  async create(customerId: string, amount: number, file: Express.Multer.File | undefined) {
    const type = proofType(file);
    const id = randomUUID();
    const path = `${customerId}/${id}.${type.ext}`;
    await this.supabase.uploadPrivate(LIQUIDATION_PROOFS_BUCKET, path, file!.buffer, type.mime);

    let inflow: Awaited<ReturnType<LiquidationsService['request']>>;
    try {
      inflow = await this.liquidations.request({ id, customerId, amount, proofPath: path });
    } catch (error) {
      await this.supabase.removePrivate(LIQUIDATION_PROOFS_BUCKET, path).catch((cleanup: unknown) => {
        this.logger.warn(`Could not remove the orphaned proof ${path}: ${String(cleanup)}`);
      });
      throw error;
    }

    void this.tellSuperAdmins(customerId, inflow.amount, inflow.id);
    return { id: inflow.id, amount: toNumber(inflow.amount), state: inflow.state, requestedAt: inflow.createdAt };
  }

  async history(customerId: string, page = 1, limit = 20, state?: PaymentInflowState) {
    const where: Prisma.PaymentInflowWhereInput = { customerId, source: 'LIQUIDATION', ...(state && { state }) };
    const [rows, total] = await Promise.all([
      this.prisma.paymentInflow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, amount: true, state: true, createdAt: true, proofPath: true },
      }),
      this.prisma.paymentInflow.count({ where }),
    ]);
    const decisions = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'PAYMENT_INFLOW',
        entityId: { in: rows.map((row) => row.id) },
        action: { in: ['PAYMENT_INFLOW_APPROVED', 'PAYMENT_INFLOW_REJECTED'] },
      },
      select: { entityId: true, createdAt: true, note: true },
    });
    const decisionOf = new Map(decisions.map((d) => [d.entityId, d]));
    const items: LiquidationHistoryItem[] = rows.map((row) => ({
      id: row.id,
      amount: toNumber(row.amount),
      state: row.state,
      requestedAt: row.createdAt,
      decidedAt: decisionOf.get(row.id)?.createdAt ?? null,
      note: decisionOf.get(row.id)?.note ?? null,
      hasProof: !!row.proofPath,
    }));
    return { items, meta: { total, page, limit } };
  }

  /** A short-lived link to a liquidation's proof; `customerId` limits it to that customer's own. */
  async proofUrl(inflowId: string, customerId?: string): Promise<string> {
    const inflow = await this.prisma.paymentInflow.findUnique({
      where: { id: inflowId },
      select: { source: true, customerId: true, proofPath: true },
    });
    if (!inflow || inflow.source !== 'LIQUIDATION' || (customerId && inflow.customerId !== customerId)) {
      throw new NotFoundException('Liquidation request not found');
    }
    if (!inflow.proofPath) throw new NotFoundException('This request has no proof attached');
    const name = inflow.proofPath.split('/').pop();
    return this.supabase.signedUrl(LIQUIDATION_PROOFS_BUCKET, inflow.proofPath, PROOF_LINK_SECONDS, name);
  }

  private async tellSuperAdmins(customerId: string, amount: Prisma.Decimal, inflowId: string): Promise<void> {
    try {
      const customer = await this.prisma.user.findUnique({ where: { id: customerId }, select: { name: true } });
      await this.adminNotifier.notifyAdmins(['SUPER_ADMIN'], {
        title: 'Liquidation request',
        message: `${customer?.name ?? customerId} sent ${formatCurrency(toNumber(amount))} to pay off their loan. Review the proof and decide.`,
        // Straight to this request on the Repayments page (Inflows tab, its details open).
        ctaUrl: `/repayments?tab=inflows&inflow=${inflowId}`,
        subject: NOTIFICATION_SUBJECT.liquidation(inflowId),
      });
    } catch (error) {
      captureJobError(error, { queue: 'liquidations', job: 'notify-super-admins' });
    }
  }
}
