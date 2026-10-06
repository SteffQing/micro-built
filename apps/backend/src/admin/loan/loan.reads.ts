import { Prisma, type CommodityRequestStatus, type LoanCategory, type LoanStatus } from '@prisma/client';
import { visibleEmail } from '@microbuilt/shared';
import { toLoanFigures, type LoanFiguresDto, type LoanFiguresSource } from 'src/common/dto/loan.dto';
import { toNumber } from 'src/ledger/money';
import type {
  ActiveLoanDto,
  CommodityRequestKind,
  LoanBorrowerDto,
  LoanCustomerRefDto,
  LoanTopupDto,
} from '../common/entities/loan.entities';

// Selects and row → response mapping shared by the admin loan services.

export const CUSTOMER_REF = {
  userId: true,
  externalId: true,
  user: { select: { name: true } },
} satisfies Prisma.CustomerSelect;

export const BORROWER = {
  userId: true,
  externalId: true,
  user: { select: { name: true, email: true, phoneNumber: true, status: true } },
} satisfies Prisma.CustomerSelect;

export const TOPUP = {
  id: true,
  amount: true,
  status: true,
  createdAt: true,
  disbursedAt: true,
  tenureChange: { select: { id: true, monthsDelta: true, status: true, reprice: true } },
} satisfies Prisma.MicroLoanSelect;

type CustomerRefRow = Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_REF }>;
type BorrowerRow = Prisma.CustomerGetPayload<{ select: typeof BORROWER }>;
type TopupRow = Prisma.MicroLoanGetPayload<{ select: typeof TOPUP }>;

export function toCustomerRef(row: CustomerRefRow): LoanCustomerRefDto {
  return { id: row.userId, name: row.user.name, externalId: row.externalId };
}

export function toBorrower(row: BorrowerRow): LoanBorrowerDto {
  return {
    id: row.userId,
    name: row.user.name,
    externalId: row.externalId,
    email: visibleEmail(row.user.email),
    phoneNumber: row.user.phoneNumber,
  };
}

export function toTopup(row: TopupRow): LoanTopupDto {
  return {
    id: row.id,
    amount: toNumber(row.amount),
    status: row.status,
    requestedAt: row.createdAt,
    disbursedAt: row.disbursedAt,
    tenureChange: row.tenureChange,
  };
}

/** A loan's summary: identity plus the ledger figures. */
export function toLoanSummary(
  loan: LoanFiguresSource & { category: LoanCategory; disbursementDate: Date | null },
  figures: Map<string, LoanFiguresDto>,
): ActiveLoanDto {
  return {
    id: loan.id,
    category: loan.category,
    status: loan.status,
    disbursementDate: loan.disbursementDate,
    ...(figures.get(loan.id) ?? toLoanFigures(loan, undefined, null)),
  };
}

/**
 * An asset request paid by a TOPUP microloan, or one on a loan that was already running, is a
 * top-up; otherwise it is the request that opened its asset loan.
 */
export function commodityKind(
  request: { status: CommodityRequestStatus; microLoan: { purpose: string } | null },
  loan: { category: LoanCategory; status: LoanStatus },
): CommodityRequestKind {
  if (request.microLoan) return request.microLoan.purpose === 'TOPUP' ? 'TOPUP' : 'NEW_LOAN';
  const opening = loan.category === 'ASSET_PURCHASE' && ['PENDING', 'APPROVED', 'REJECTED'].includes(loan.status);
  return opening ? 'NEW_LOAN' : 'TOPUP';
}

/** Rate fraction → percent for display (0.03 → 3). */
export function percent(rate: Prisma.Decimal): number {
  return rate.mul(100).toNumber();
}
