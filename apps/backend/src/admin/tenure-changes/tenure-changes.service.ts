import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { loanBalancesMany, openExpectedMany } from 'src/ledger/balances';
import { openExpected, repriceInterest } from 'src/ledger/ledger.math';
import { money, toNumber } from 'src/ledger/money';
import { TenureChangesService } from 'src/ledger/tenure-changes.service';
import { SettingsService } from 'src/settings/settings.service';
import type { ProposeTenureChangeDto, TenureChangeItemDto, TenureChangeQueryDto } from './tenure-changes.dto';

const CHANGE_INCLUDE = {
  loan: {
    select: {
      id: true,
      tenure: true,
      borrower: { select: { userId: true, externalId: true, user: { select: { name: true } } } },
    },
  },
  requestedBy: { select: { userId: true, user: { select: { name: true } } } },
} satisfies Prisma.TenureChangeInclude;

type ChangeRow = Prisma.TenureChangeGetPayload<{ include: typeof CHANGE_INCLUDE }>;

// The admins' side of tenure changes (V2.MD Stage 6): the queue of proposals — the system's after
// a default broke the net-pay cap, or an admin's — with what deciding each would do to the
// customer's monthly deduction. The ledger does the deciding.
@Injectable()
export class TenureChangesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly changes: TenureChangesService,
    private readonly settings: SettingsService,
  ) {}

  async list(query: TenureChangeQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TenureChangeWhereInput = { status: query.status };
    const [rows, total] = await Promise.all([
      this.prisma.tenureChange.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: CHANGE_INCLUDE,
      }),
      this.prisma.tenureChange.count({ where }),
    ]);
    return { items: await this.present(rows), meta: { total, page, limit } };
  }

  /** An admin's change to a customer's live loan; `apply` approves it in the same call. */
  async propose(customerId: string, dto: ProposeTenureChangeDto, actorId: string): Promise<TenureChangeItemDto> {
    const loan = await this.prisma.loan.findFirst({
      where: { borrowerId: customerId, status: 'DISBURSED' },
      select: { id: true },
    });
    if (!loan) {
      const exists = await this.prisma.customer.count({ where: { userId: customerId } });
      if (!exists) throw new NotFoundException('Customer not found');
      throw new ConflictException('This customer has no active loan');
    }
    const change = await this.changes.propose({
      loanId: loan.id,
      monthsDelta: dto.monthsDelta,
      reason: 'ADMIN',
      requestedById: actorId,
      apply: dto.apply,
      reprice: dto.reprice,
    });
    return this.one(change.id);
  }

  async approve(id: string, actorId: string): Promise<TenureChangeItemDto> {
    await this.changes.approve(id, actorId);
    return this.one(id);
  }

  async reject(id: string, actorId: string, note?: string): Promise<TenureChangeItemDto> {
    await this.changes.reject(id, actorId, note);
    return this.one(id);
  }

  private async one(id: string): Promise<TenureChangeItemDto> {
    const row = await this.prisma.tenureChange.findUnique({ where: { id }, include: CHANGE_INCLUDE });
    if (!row) throw new NotFoundException('Tenure change not found');
    const [item] = await this.present([row]);
    return item;
  }

  private async present(rows: ChangeRow[]): Promise<TenureChangeItemDto[]> {
    if (rows.length === 0) return [];
    const pending = rows.filter((row) => row.status === 'PENDING');
    const loanIds = [...new Set(pending.map((row) => row.loanId))];
    const externalIds = [
      ...new Set(pending.map((row) => row.loan.borrower.externalId).filter((id): id is string => !!id)),
    ];
    const [balances, monthly, payrolls, decisions, settings] = await Promise.all([
      loanBalancesMany(this.prisma, loanIds),
      openExpectedMany(this.prisma, loanIds),
      this.prisma.customerPayroll.findMany({
        where: { externalId: { in: externalIds } },
        select: { externalId: true, netPay: true },
      }),
      this.prisma.auditLog.findMany({
        where: {
          entityType: 'TENURE_CHANGE',
          entityId: { in: rows.map((row) => row.id) },
          action: { in: ['TENURE_CHANGE_APPROVED', 'TENURE_CHANGE_REJECTED'] },
        },
        select: { entityId: true, createdAt: true, note: true },
      }),
      pending.length > 0 ? this.settings.get() : null,
    ]);
    const netPayOf = new Map(payrolls.map((p) => [p.externalId, money(p.netPay)]));
    const decisionOf = new Map(decisions.map((d) => [d.entityId, d]));

    return rows.map((row) => {
      const decision = decisionOf.get(row.id);
      const item: TenureChangeItemDto = {
        id: row.id,
        loanId: row.loanId,
        customer: { id: row.loan.borrower.userId, name: row.loan.borrower.user.name },
        reason: row.reason,
        status: row.status,
        monthsDelta: row.monthsDelta,
        previousTenure: row.previousTenure,
        loanTenure: row.loan.tenure,
        requestedBy: row.requestedBy ? { id: row.requestedBy.userId, name: row.requestedBy.user.name } : null,
        topupId: row.microLoanId,
        reprice: row.reprice,
        interestAdded: row.interestAdded === null ? null : toNumber(row.interestAdded),
        createdAt: row.createdAt,
        decidedAt: decision?.createdAt ?? null,
        note: decision?.note ?? null,
        netPay: null,
        cap: null,
        currentMonthly: null,
        proposedMonthly: null,
      };
      if (row.status !== 'PENDING') return item;

      const externalId = row.loan.borrower.externalId;
      const netPay = externalId ? netPayOf.get(externalId) : undefined;
      const rate = settings?.maxDeductionRate ?? null;
      item.netPay = netPay && netPay.gt(0) ? toNumber(netPay) : null;
      item.cap = netPay && netPay.gt(0) && rate ? toNumber(netPay.times(rate)) : null;
      const current = monthly.get(row.loanId);
      item.currentMonthly = current ? toNumber(current) : null;
      const loan = balances.get(row.loanId);
      if (loan && loan.status === 'DISBURSED') {
        const remaining = Math.max(1, loan.tenure + row.monthsDelta - loan.frozenCount);
        const interest = row.reprice
          ? repriceInterest(loan.booked, loan.collected, loan.committed, loan.interestRate, row.monthsDelta)
          : null;
        if (interest) item.interestAdded = toNumber(interest);
        item.proposedMonthly = toNumber(
          openExpected(money(loan.outstanding.plus(interest ?? 0)), loan.committed, remaining),
        );
      }
      return item;
    });
  }
}
