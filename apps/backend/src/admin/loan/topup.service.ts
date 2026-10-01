import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerService } from 'src/ledger/ledger.service';
import { LedgerTx } from 'src/ledger/ledger.tx';
import type { TopupQueryDto } from '../common/dto/loan.dto';
import type { TopupItemDto } from '../common/entities/loan.entities';
import { CUSTOMER_REF, TOPUP, toCustomerRef, toTopup } from './loan.reads';
import { assertCanReceiveMoney } from './loan.service';

const TOPUP_ROW = {
  ...TOPUP,
  loanId: true,
  loan: { select: { borrower: { select: CUSTOMER_REF } } },
  commodity: { select: { id: true, commodity: { select: { name: true } } } },
} satisfies Prisma.MicroLoanSelect;

type TopupRow = Prisma.MicroLoanGetPayload<{ select: typeof TOPUP_ROW }>;

function toTopupItem(row: TopupRow): TopupItemDto {
  return {
    ...toTopup(row),
    loanId: row.loanId,
    customer: toCustomerRef(row.loan.borrower),
    asset: row.commodity ? { id: row.commodity.id, name: row.commodity.commodity.name } : null,
  };
}

// Top-ups on running loans: TOPUP microloans, requested by customers (or for them) and decided
// here. The ledger does the deciding and disbursing (compare-and-swap, audit, events).
@Injectable()
export class TopupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly ledger: LedgerService,
  ) {}

  async list(dto: TopupQueryDto) {
    const { page = 1, limit = 20 } = dto;
    const where: Prisma.MicroLoanWhereInput = { purpose: 'TOPUP', ...(dto.status && { status: dto.status }) };
    const [rows, total] = await Promise.all([
      this.prisma.microLoan.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: TOPUP_ROW,
      }),
      this.prisma.microLoan.count({ where }),
    ]);
    return { data: rows.map(toTopupItem), meta: { total, page, limit }, message: 'Queried all top-ups' };
  }

  async get(id: string): Promise<TopupItemDto> {
    const row = await this.prisma.microLoan.findFirst({ where: { id, purpose: 'TOPUP' }, select: TOPUP_ROW });
    if (!row) throw new NotFoundException('Top-up not found');
    return toTopupItem(row);
  }

  async approve(id: string, actorId: string): Promise<void> {
    await this.ledger.approveTopup(id, actorId);
  }

  /** Turns the top-up down; the asset request it would have paid for is turned down with it. */
  async reject(id: string, actorId: string, note?: string): Promise<void> {
    await this.ledgerTx.transaction(async (tx) => {
      await this.ledger.rejectTopup(id, actorId, note, tx);
      const request = await tx.commodityLoan.findFirst({
        where: { microLoanId: id, status: { not: 'REJECTED' } },
        select: { id: true },
      });
      if (!request) return;
      await tx.commodityLoan.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
      await this.ledgerTx.audit(tx, {
        actorId,
        action: 'COMMODITY_REJECTED',
        entityType: 'COMMODITY_LOAN',
        entityId: request.id,
        note: note ?? 'Its top-up was rejected',
      });
    });
  }

  async disburse(id: string, actorId: string): Promise<void> {
    const row = await this.prisma.microLoan.findFirst({
      where: { id, purpose: 'TOPUP' },
      select: { loan: { select: { borrower: { select: { user: { select: { status: true } } } } } } },
    });
    if (!row) throw new NotFoundException('Top-up not found');
    assertCanReceiveMoney(row.loan.borrower.user.status);
    await this.ledger.disburseTopup(id, actorId);
  }
}
