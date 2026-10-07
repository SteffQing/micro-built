import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { comparePeriods, MONTHS, monthNumber, periodLabel, toYm, type Period } from '@microbuilt/shared';
import { Prisma, type Month } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { organizationPayrollStates } from 'src/organizations/organizations';
import { loanBalancesMany } from './balances';
import { LedgerClock } from './ledger.clock';
import { openExpected, remainingMonths } from './ledger.math';
import { LedgerTx, type Tx } from './ledger.tx';
import { money, sum, ZERO, type Money } from './money';
import { lagosMonthOf } from './period';
import { PeriodsService } from './periods.service';
import {
  buildVariationWorkbook,
  classifyVariation,
  variationDates,
  variationFileName,
  variationFilePath,
  XLSX_MIME,
  type VariationAction,
  type VariationReason,
  type VariationRow,
} from './variation';

export const VARIATIONS_BUCKET = 'variations';

export interface VariationFilter {
  action?: VariationAction;
  reason?: VariationReason;
}

/** A variation is locked by its voucher, or by a no payroll when none came (PLAN_V2 §0.2). */
export type VariationLock =
  | { kind: 'VOUCHER'; voucherId: string; filename: string; uploadedAt: Date }
  | { kind: 'NO_PAYROLL'; reason: string };

export interface VariationState {
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lock: VariationLock | null;
  /** R3: generated before the organization's previous month last locked or was reverted. */
  regenerateHint: boolean;
  /** File versions still stored (P4), ascending. */
  versions: number[];
}

export interface VariationPreview {
  organization: { id: string; name: string };
  period: { year: number; month: Month; ym: string; label: string };
  variation: VariationState | null;
  /** After the filter. */
  rows: VariationRow[];
  /** Over every row, before the filter. */
  counts: Record<VariationAction, number>;
  /** Deductions generating would freeze (unchanged ones included); once frozen, the variation's own. */
  frozen: number;
  /** The organization has no deductions for the month: nothing to generate, no voucher to expect. */
  skipped: boolean;
  /** Why generating is refused now (R3), or null. */
  generateBlockedBy: string | null;
}

export interface GeneratedVariation {
  variationId: string;
  organizationId: string;
  organization: string;
  /** "OCTOBER 2026" */
  period: string;
  ym: string;
  version: number;
  filePath: string;
  rows: number;
  counts: Record<VariationAction, number>;
  frozen: number;
  amount: Money;
}

export interface VariationSummary {
  id: string;
  period: { year: number; month: Month; ym: string; label: string };
  version: number;
  updatedAt: Date;
  lock: VariationLock | null;
}

/**
 * R2's categories: (a) OPEN in the month, (b) already AWAITING in this variation (with any OPEN row
 * of the next month folded in), (c) an OPEN row of a later month for a loan disbursed by this month
 * with no row in it, (d) a running loan waiting only on an earlier unlocked variation (no OPEN row,
 * nothing from this month on).
 *
 * And for a borrower who moved to another organization (P12, Stage D step 6), neither repriced nor
 * frozen again: KEPT, a deduction already frozen into this variation before the move (it stays with
 * the variation it was sent in, so it stays on the file); LEFT, a loan this organization's payroll
 * still deducts (its last amount sent here wasn't 0) and that this is the first variation since: the
 * file lists its STOP, and the next month's variation no longer does.
 */
type CandidateKind = 'OPEN' | 'AWAITING' | 'NEXT' | 'NEW' | 'KEPT' | 'LEFT';

interface Candidate {
  kind: CandidateKind;
  loanId: string;
  /** The row frozen into the month (a, b, c, KEPT); null for (d), which gets a new one, and LEFT. */
  deductionId: string | null;
  /** (b) and KEPT: its frozen amount, left out of `committed` when recomputing (b). */
  frozenAmount: Money | null;
  /** (b): the OPEN row folded back in. */
  foldId: string | null;
}

interface Priced extends Candidate {
  amount: Money;
  /** Months left to deduct from this month. */
  tenure: number;
}

interface VariationRecord {
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  noPayrollReason: string | null;
  voucher: { id: string; filename: string; createdAt: Date } | null;
}

interface Scan {
  /** `pending`: named by an admin or marketer and not approved by a super admin yet. */
  organization: { id: string; name: string; pending?: boolean };
  period: Period;
  label: string;
  variation: VariationRecord | null;
  /** The organization's earliest variation after the month. */
  later: Period | null;
  /** The earliest month before this one still holding an OPEN deduction of the organization's loans. */
  earlierOpen: Period | null;
  candidates: Candidate[];
}

/** The deductions a variation holds: a LEFT row is only a STOP on the file. */
function frozenCount(items: Candidate[]): number {
  return items.filter((item) => item.kind !== 'LEFT').length;
}

function countActions(rows: VariationRow[]): Record<VariationAction, number> {
  const counts = { START: 0, AMEND: 0, STOP: 0 };
  for (const row of rows) counts[row.action]++;
  return counts;
}

/** Months strictly before / from / strictly after `period`, as a Period filter (Prisma can't compare enum values). */
function periodsBefore(period: Period): Prisma.PeriodWhereInput {
  return {
    OR: [
      { year: { lt: period.year } },
      { year: period.year, month: { in: MONTHS.slice(0, monthNumber(period.month) - 1) as Month[] } },
    ],
  };
}

function periodsFrom(period: Period): Prisma.PeriodWhereInput {
  return {
    OR: [
      { year: { gt: period.year } },
      { year: period.year, month: { in: MONTHS.slice(monthNumber(period.month) - 1) as Month[] } },
    ],
  };
}

function periodsAfter(period: Period): Prisma.PeriodWhereInput {
  return {
    OR: [
      { year: { gt: period.year } },
      { year: period.year, month: { in: MONTHS.slice(monthNumber(period.month)) as Month[] } },
    ],
  };
}

function lockOf(variation: Pick<VariationRecord, 'noPayrollReason' | 'voucher'>): VariationLock | null {
  if (variation.voucher) {
    return {
      kind: 'VOUCHER',
      voucherId: variation.voucher.id,
      filename: variation.voucher.filename,
      uploadedAt: variation.voucher.createdAt,
    };
  }
  return variation.noPayrollReason !== null ? { kind: 'NO_PAYROLL', reason: variation.noPayrollReason } : null;
}

const VARIATION_SELECT = {
  id: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  noPayrollReason: true,
  voucher: { select: { id: true, filename: true, createdAt: true } },
} satisfies Prisma.VariationSelect;

// Each organization's variation for a month (PLAN_V2 §1 R1–R3): what its payroll must start, amend
// or stop. Generating freezes every deduction of the organization for the month (unchanged ones
// too: the voucher settles them) and writes the change list as a new file version; generating
// again recomputes and replaces it, until the voucher (or a no payroll) locks the variation.
@Injectable()
export class VariationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerTx: LedgerTx,
    private readonly periods: PeriodsService,
    private readonly supabase: SupabaseService,
    private readonly clock: LedgerClock,
  ) {}

  async preview(organizationId: string, period: Period, filter: VariationFilter = {}): Promise<VariationPreview> {
    const organization = await this.organizationOrThrow(organizationId);
    const scan = await this.scan(this.prisma, organization, period);
    const variation = scan.variation;
    const frozenView = variation !== null && (lockOf(variation) !== null || scan.later !== null);

    let rows: VariationRow[];
    let frozen: number;
    if (variation && frozenView) {
      // What it holds, plus the STOPs it carried for borrowers who had moved away (never frozen).
      const left = scan.candidates.filter((candidate) => candidate.kind === 'LEFT');
      const items = [
        ...(await this.frozenItems(this.prisma, variation.id, period)),
        ...(await this.price(this.prisma, organization.id, period, left)),
      ];
      rows = await this.buildRows(this.prisma, organization.id, period, items);
      frozen = frozenCount(items);
    } else {
      const items = await this.price(this.prisma, organization.id, period, scan.candidates);
      rows = await this.buildRows(this.prisma, organization.id, period, items);
      frozen = frozenCount(items);
    }

    return {
      organization,
      period: { year: period.year, month: period.month as Month, ym: toYm(period), label: scan.label },
      variation: variation ? await this.state(variation, organization.id, scan.later !== null) : null,
      rows: rows.filter(
        (row) =>
          (!filter.action || row.action === filter.action) &&
          (!filter.reason || row.reasons.includes(filter.reason)),
      ),
      counts: countActions(rows),
      frozen,
      skipped: this.skipped(scan),
      generateBlockedBy: this.blocker(scan),
    };
  }

  /** Whether generating for this organization and month would go ahead, without pricing anything. */
  async generationCheck(
    organizationId: string,
    period: Period,
  ): Promise<{ organization: { id: string; name: string }; skipped: boolean; blockedBy: string | null }> {
    const organization = await this.organizationOrThrow(organizationId);
    const scan = await this.scan(this.prisma, organization, period);
    return { organization, skipped: this.skipped(scan), blockedBy: this.blocker(scan) };
  }

  buildWorkbook(rows: VariationRow[]): Buffer {
    return buildVariationWorkbook(rows);
  }

  /**
   * R3: freezes the organization's deductions for the month and writes the change list as a new file
   * version, in one transaction. The variation row and then the organization's loans are locked first,
   * so a payment landing meanwhile waits and then counts against the next month. The file is uploaded
   * before the commit; if anything after it fails, the new object is removed and the last version
   * stays current.
   */
  async generate(organizationId: string, period: Period, actorId: string): Promise<GeneratedVariation> {
    const organization = await this.organizationOrThrow(organizationId);
    const label = periodLabel(period);
    let uploaded: string | null = null;
    try {
      return await this.ledgerTx.transaction(
        async (tx) => {
          const periodRow = await this.periods.ensure(period, tx);
          const now = this.clock.now();
          // Version 0 lives only inside this transaction: the first generation makes it 1.
          await tx.$executeRaw`
            INSERT INTO "Variation" ("id", "periodId", "organizationId", "version", "filePath", "createdAt", "updatedAt")
            VALUES (${randomUUID()}, ${periodRow.id}, ${organizationId}, 0, '', ${now}, ${now})
            ON CONFLICT ("periodId", "organizationId") DO NOTHING`;
          const [locked] = await tx.$queryRaw<{ id: string; version: number }[]>`
            SELECT "id", "version" FROM "Variation"
            WHERE "periodId" = ${periodRow.id} AND "organizationId" = ${organizationId} FOR UPDATE`;

          const loanIds = await this.organizationLoanIds(tx, organizationId);
          if (loanIds.length) {
            await tx.$queryRaw`
              SELECT "id" FROM "Loan" WHERE "id" IN (${Prisma.join(loanIds)}) ORDER BY "id" FOR UPDATE`;
          }

          const scan = await this.scan(tx, organization, period);
          const blocker = this.blocker(scan);
          if (blocker) throw new ConflictException(blocker);

          const items = await this.price(tx, organizationId, period, scan.candidates);
          const rows = await this.buildRows(tx, organizationId, period, items);
          for (const item of items) await this.freeze(tx, item, locked.id, periodRow.id);

          const version = locked.version + 1;
          const filePath = variationFilePath(organizationId, period, version);
          await this.supabase.uploadPrivate(VARIATIONS_BUCKET, filePath, buildVariationWorkbook(rows), XLSX_MIME);
          uploaded = filePath;
          await tx.variation.update({ where: { id: locked.id }, data: { version, filePath, updatedAt: now } });

          const counts = countActions(rows);
          await this.ledgerTx.audit(tx, {
            actorId,
            action: 'VARIATION_GENERATED',
            entityType: 'VARIATION',
            entityId: locked.id,
            note:
              `${organization.name} ${label} v${version}: ${rows.length} changes ` +
              `(${counts.START} start, ${counts.AMEND} amend, ${counts.STOP} stop), ${frozenCount(items)} deductions frozen`,
          });
          return {
            variationId: locked.id,
            organizationId,
            organization: organization.name,
            period: label,
            ym: toYm(period),
            version,
            filePath,
            rows: rows.length,
            counts,
            frozen: frozenCount(items),
            amount: sum(rows.map((row) => row.amount)),
          };
        },
        { timeout: 120_000 },
      );
    } catch (error) {
      if (uploaded) await this.supabase.removePrivate(VARIATIONS_BUCKET, uploaded).catch(() => undefined);
      throw error;
    }
  }

  /** The organization's variations, newest month first. */
  async history(organizationId: string): Promise<VariationSummary[]> {
    await this.organizationOrThrow(organizationId);
    const variations = await this.prisma.variation.findMany({
      where: { organizationId, version: { gt: 0 } },
      select: { ...VARIATION_SELECT, period: { select: { year: true, month: true } } },
      orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
    });
    return variations.map((variation) => ({
      id: variation.id,
      period: { ...variation.period, ym: toYm(variation.period), label: periodLabel(variation.period) },
      version: variation.version,
      updatedAt: variation.updatedAt,
      lock: lockOf(variation),
    }));
  }

  /** Where a stored version of a variation is (default: the current one), and the name to download it as. */
  async file(variationId: string, version?: number): Promise<{ path: string; fileName: string; version: number }> {
    const variation = await this.prisma.variation.findUnique({
      where: { id: variationId },
      select: {
        ...VARIATION_SELECT,
        organization: { select: { id: true, name: true } },
        period: { select: { year: true, month: true } },
      },
    });
    if (!variation || variation.version < 1) throw new NotFoundException('Variation not found');
    const wanted = version ?? variation.version;
    if (!this.versionsKept(variation).includes(wanted)) {
      throw new NotFoundException(`Version ${wanted} of this variation isn't stored`);
    }
    return {
      path: variationFilePath(variation.organization.id, variation.period, wanted),
      fileName: variationFileName(variation.organization.name, variation.period, wanted),
      version: wanted,
    };
  }

  // ── R2: what the month holds ───────────────────────────────────────────────

  private async organizationOrThrow(organizationId: string): Promise<{ id: string; name: string; pending: boolean }> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, status: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    return { id: organization.id, name: organization.name, pending: organization.status === 'PENDING' };
  }

  /** The organization's loans that can hold a live deduction: running, or with an OPEN/AWAITING row. */
  private async organizationLoanIds(db: Tx, organizationId: string): Promise<string[]> {
    const loans = await db.loan.findMany({
      where: {
        borrower: { payroll: { organizationId } },
        OR: [{ status: 'DISBURSED' }, { deductions: { some: { status: { in: ['OPEN', 'AWAITING'] } } } }],
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return loans.map((loan) => loan.id);
  }

  private async scan(db: Tx, organization: { id: string; name: string }, period: Period): Promise<Scan> {
    const label = periodLabel(period);
    const [variation, later] = await Promise.all([
      db.variation.findFirst({
        where: { organizationId: organization.id, period: { year: period.year, month: period.month as Month } },
        select: VARIATION_SELECT,
      }),
      db.variation.findFirst({
        where: { organizationId: organization.id, version: { gt: 0 }, period: periodsAfter(period) },
        orderBy: [{ period: { year: 'asc' } }, { period: { month: 'asc' } }],
        select: { period: { select: { year: true, month: true } } },
      }),
    ]);

    const loans = await db.loan.findMany({
      where: {
        borrower: { payroll: { organizationId: organization.id } },
        OR: [{ status: 'DISBURSED' }, { deductions: { some: { status: { in: ['OPEN', 'AWAITING'] } } } }],
      },
      select: { id: true, status: true, disbursementDate: true },
    });
    const loanIds = loans.map((loan) => loan.id);
    const deductions = loanIds.length
      ? await db.deduction.findMany({
          where: {
            loanId: { in: loanIds },
            OR: [{ status: { in: ['OPEN', 'AWAITING'] } }, { period: periodsFrom(period) }],
          },
          select: {
            id: true,
            loanId: true,
            status: true,
            expected: true,
            variationId: true,
            period: { select: { year: true, month: true } },
          },
        })
      : [];
    const byLoan = new Map<string, typeof deductions>();
    for (const deduction of deductions) {
      const own = byLoan.get(deduction.loanId) ?? [];
      own.push(deduction);
      byLoan.set(deduction.loanId, own);
    }

    let earlierOpen: Period | null = null;
    const candidates: Candidate[] = [];
    for (const loan of loans) {
      const own = byLoan.get(loan.id) ?? [];
      const open = own.find((d) => d.status === 'OPEN') ?? null;
      if (open && comparePeriods(open.period, period) < 0) {
        if (!earlierOpen || comparePeriods(open.period, earlierOpen) < 0) earlierOpen = open.period;
        continue;
      }
      const inMonth = own.find((d) => comparePeriods(d.period, period) === 0) ?? null;
      if (inMonth) {
        if (inMonth.status === 'OPEN') {
          candidates.push({ kind: 'OPEN', loanId: loan.id, deductionId: inMonth.id, frozenAmount: null, foldId: null });
        } else if (inMonth.status === 'AWAITING' && variation && inMonth.variationId === variation.id) {
          candidates.push({
            kind: 'AWAITING',
            loanId: loan.id,
            deductionId: inMonth.id,
            frozenAmount: money(inMonth.expected),
            foldId: open?.id ?? null,
          });
        }
        // Frozen into another organization's variation (the borrower moved, P11) or already settled: not ours.
        continue;
      }
      const disbursedBy =
        loan.disbursementDate !== null && comparePeriods(lagosMonthOf(loan.disbursementDate), period) <= 0;
      if (open) {
        if (disbursedBy) {
          candidates.push({ kind: 'NEXT', loanId: loan.id, deductionId: open.id, frozenAmount: null, foldId: null });
        }
        continue;
      }
      const fromMonth = own.some((d) => comparePeriods(d.period, period) >= 0);
      if (loan.status === 'DISBURSED' && !fromMonth && disbursedBy) {
        candidates.push({ kind: 'NEW', loanId: loan.id, deductionId: null, frozenAmount: null, foldId: null });
      }
    }
    candidates.push(...(await this.movedAway(db, organization.id, period, variation, loanIds)));

    return { organization, period, label, variation, later: later?.period ?? null, earlierOpen, candidates };
  }

  /** KEPT and LEFT: the loans of borrowers who have moved to another organization (see CandidateKind). */
  private async movedAway(
    db: Tx,
    organizationId: string,
    period: Period,
    variation: VariationRecord | null,
    ownLoanIds: string[],
  ): Promise<Candidate[]> {
    const kept = variation
      ? await db.deduction.findMany({
          where: { variationId: variation.id, loanId: { notIn: ownLoanIds } },
          select: { id: true, loanId: true, expected: true },
        })
      : [];
    const candidates: Candidate[] = kept.map((row) => ({
      kind: 'KEPT',
      loanId: row.loanId,
      deductionId: row.id,
      frozenAmount: money(row.expected),
      foldId: null,
    }));

    // Each moved borrower's loan: its latest deduction sent in one of this organization's variations before the month.
    const lastSent = await db.$queryRaw<{ loanId: string; expected: Prisma.Decimal; year: number; month: Month }[]>`
      SELECT DISTINCT ON (d."loanId") d."loanId", d."expected", p."year", p."month"
      FROM "Deduction" d
      JOIN "Period" p ON p."id" = d."periodId"
      JOIN "Variation" v ON v."id" = d."variationId"
      JOIN "Loan" l ON l."id" = d."loanId"
      JOIN "Customer" c ON c."userId" = l."borrowerId"
      LEFT JOIN "CustomerPayroll" cp ON cp."externalId" = c."externalId"
      WHERE v."organizationId" = ${organizationId} AND d."status" <> 'OPEN'
        AND (p."year" < ${period.year} OR (p."year" = ${period.year} AND p."month" < ${period.month}::"Month"))
        AND cp."organizationId" IS DISTINCT FROM ${organizationId}
      ORDER BY d."loanId", p."year" DESC, p."month" DESC`;
    const stillDeducted = lastSent.filter(
      (row) => !money(row.expected).isZero() && !candidates.some((c) => c.loanId === row.loanId),
    );
    if (stillDeducted.length === 0) return candidates;

    // The STOP goes in the organization's first variation after that month, and only that one.
    const sentMonths = await db.variation.findMany({
      where: { organizationId, version: { gt: 0 }, period: periodsBefore(period) },
      select: { period: { select: { year: true, month: true } } },
    });
    for (const row of stillDeducted) {
      const sentSince = sentMonths.some((v) => comparePeriods(v.period, row) > 0);
      if (!sentSince) {
        candidates.push({ kind: 'LEFT', loanId: row.loanId, deductionId: null, frozenAmount: null, foldId: null });
      }
    }
    return candidates;
  }

  private skipped(scan: Scan): boolean {
    return scan.variation === null && scan.candidates.length === 0 && scan.earlierOpen === null;
  }

  /** Why generating is refused (R3), or null. */
  private blocker(scan: Scan): string | null {
    const { organization, label } = scan;
    const lock = scan.variation ? lockOf(scan.variation) : null;
    if (lock?.kind === 'VOUCHER') return `${organization.name}'s ${label} variation is locked: its voucher is in`;
    if (lock?.kind === 'NO_PAYROLL') return `${organization.name}'s ${label} variation is locked: it was marked No payroll`;
    if (organization.pending) {
      return `${organization.name} is waiting for a super admin to approve it (or merge it into the organization it misspelt)`;
    }
    if (scan.later) {
      return `${organization.name}'s ${periodLabel(scan.later)} variation already exists, so ${label} can't change any more`;
    }
    if (scan.earlierOpen) return `Generate ${organization.name}'s ${periodLabel(scan.earlierOpen)} variation first`;
    if (scan.candidates.length === 0) return `${organization.name} has no deductions for ${label}`;
    return null;
  }

  /**
   * Each candidate's amount for the month: the formula as if its row were OPEN (V2.MD §0.5), so a
   * row already frozen here (b) leaves itself out of `committed` and of the frozen months. A loan no
   * longer running gets 0, the STOP.
   */
  private async price(db: Tx, organizationId: string, period: Period, candidates: Candidate[]): Promise<Priced[]> {
    if (candidates.length === 0) return [];
    const loanIds = candidates.map((c) => c.loanId);
    const [balances, priors] = await Promise.all([
      loanBalancesMany(db, loanIds),
      this.priors(db, organizationId, period, loanIds),
    ]);
    return candidates.map((candidate) => {
      const b = balances.get(candidate.loanId);
      if (!b) throw new Error(`No balances for loan ${candidate.loanId}`);
      // Moved away: KEPT stays at what was sent; LEFT is stopped here.
      if (candidate.kind === 'KEPT') {
        const amount = candidate.frozenAmount ?? ZERO;
        return { ...candidate, amount, tenure: remainingMonths(b.tenure, b.frozenCount - 1) };
      }
      if (candidate.kind === 'LEFT') return { ...candidate, amount: ZERO, tenure: 0 };
      const prior = priors.get(candidate.loanId)?.expected ?? null;
      const frozenAmount = candidate.frozenAmount;
      const frozenCount = frozenAmount ? b.frozenCount - 1 : b.frozenCount;
      const committed = frozenAmount ? money(b.committed.minus(frozenAmount)) : b.committed;
      const tenure = remainingMonths(b.tenure, frozenCount);
      const amount = b.status === 'DISBURSED' ? openExpected(b.outstanding, committed, tenure, prior) : ZERO;
      return { ...candidate, amount, tenure };
    });
  }

  /** The rows a frozen variation holds: its deductions at their frozen amounts. */
  private async frozenItems(db: Tx, variationId: string, period: Period): Promise<Priced[]> {
    const rows = await db.deduction.findMany({
      where: { variationId },
      select: { id: true, loanId: true, expected: true },
    });
    if (rows.length === 0) return [];
    const loanIds = rows.map((row) => row.loanId);
    const [balances, before] = await Promise.all([
      loanBalancesMany(db, loanIds),
      db.deduction.groupBy({
        by: ['loanId'],
        where: { loanId: { in: loanIds }, status: { not: 'OPEN' }, period: periodsBefore(period) },
        _count: true,
      }),
    ]);
    const frozenBefore = new Map(before.map((row) => [row.loanId, row._count]));
    return rows.map((row) => {
      const b = balances.get(row.loanId);
      return {
        kind: 'AWAITING' as const,
        loanId: row.loanId,
        deductionId: row.id,
        frozenAmount: money(row.expected),
        foldId: null,
        amount: money(row.expected),
        tenure: remainingMonths(b?.tenure ?? 1, frozenBefore.get(row.loanId) ?? 0),
      };
    });
  }

  /** R3's writes for one candidate: frozen into the month at its amount, linked to the variation. */
  private async freeze(tx: Tx, item: Priced, variationId: string, periodId: string): Promise<void> {
    const data = { status: 'AWAITING' as const, variationId, expected: item.amount };
    switch (item.kind) {
      case 'AWAITING':
        await tx.deduction.update({ where: { id: item.deductionId as string }, data: { expected: item.amount } });
        // The change it was carrying for next month is now in this month's amount.
        if (item.foldId) await tx.deduction.deleteMany({ where: { id: item.foldId, status: 'OPEN' } });
        return;
      case 'OPEN':
        await tx.deduction.update({ where: { id: item.deductionId as string }, data });
        return;
      case 'NEXT':
        await tx.deduction.update({ where: { id: item.deductionId as string }, data: { ...data, periodId } });
        return;
      case 'NEW':
        await tx.deduction.create({ data: { loanId: item.loanId, periodId, ...data } });
        return;
      case 'KEPT':
      case 'LEFT':
        // Already frozen here before the move, or the new organization's to deduct: nothing to write.
        return;
    }
  }

  /**
   * What each loan's payroll at this organization was last sent before the month: its latest frozen
   * deduction in an earlier month whose variation is this organization's (P12: a borrower who moved
   * starts afresh). A row with no variation (history from before variations) counts as the
   * borrower's current organization.
   */
  private async priors(
    db: Tx,
    organizationId: string,
    period: Period,
    loanIds: string[],
  ): Promise<Map<string, { expected: Money; frozenAt: Date }>> {
    if (loanIds.length === 0) return new Map();
    const rows = await db.$queryRaw<{ loanId: string; expected: Prisma.Decimal; frozenAt: Date }[]>`
      SELECT DISTINCT ON (d."loanId") d."loanId", d."expected",
             COALESCE(v."updatedAt", d."createdAt") AS "frozenAt"
      FROM "Deduction" d
      JOIN "Period" p ON p."id" = d."periodId"
      LEFT JOIN "Variation" v ON v."id" = d."variationId"
      WHERE d."loanId" IN (${Prisma.join(loanIds)}) AND d."status" <> 'OPEN'
        AND (p."year" < ${period.year} OR (p."year" = ${period.year} AND p."month" < ${period.month}::"Month"))
        AND (d."variationId" IS NULL OR v."organizationId" = ${organizationId})
      ORDER BY d."loanId", p."year" DESC, p."month" DESC`;
    return new Map(rows.map((row) => [row.loanId, { expected: money(row.expected), frozenAt: row.frozenAt }]));
  }

  /** The change list: every item whose amount differs from what the organization's payroll last had. */
  private async buildRows(
    db: Tx,
    organizationId: string,
    period: Period,
    items: Priced[],
  ): Promise<VariationRow[]> {
    if (items.length === 0) return [];
    const loanIds = items.map((item) => item.loanId);
    const [loans, priors, balances] = await Promise.all([
      db.loan.findMany({
        where: { id: { in: loanIds } },
        select: {
          id: true,
          borrowerId: true,
          borrower: {
            select: { externalId: true, user: { select: { name: true } }, payroll: { select: { command: true } } },
          },
        },
      }),
      this.priors(db, organizationId, period, loanIds),
      loanBalancesMany(db, loanIds),
    ]);
    const loanById = new Map(loans.map((loan) => [loan.id, loan]));
    const activity = await this.activitySince(
      db,
      [...priors.entries()].map(([loanId, prior]) => ({ loanId, frozenAt: prior.frozenAt })),
    );

    const rows: VariationRow[] = [];
    for (const item of items) {
      const prior = priors.get(item.loanId) ?? null;
      const action = classifyVariation(item.amount, prior?.expected ?? null);
      if (!action) continue;
      const loan = loanById.get(item.loanId);
      const b = balances.get(item.loanId);
      if (!loan || !b) continue;
      const tenure = action === 'STOP' ? 0 : item.tenure;
      const { start, end } = variationDates(period, tenure);
      rows.push({
        loanId: item.loanId,
        customerId: loan.borrowerId,
        externalId: loan.borrower.externalId,
        name: loan.borrower.user.name,
        command: loan.borrower.payroll?.command ?? null,
        balance: b.outstanding,
        amount: item.amount,
        tenure,
        action,
        reasons: item.kind === 'LEFT' ? ['TRANSFER'] : prior ? (activity.get(item.loanId) ?? []) : ['NEW_LOAN'],
        start,
        end,
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name) || (a.externalId ?? '').localeCompare(b.externalId ?? ''));
  }

  /** Why each loan's deduction moved: what happened to it after its last amount went to payroll. */
  private async activitySince(
    db: Tx,
    priors: { loanId: string; frozenAt: Date }[],
  ): Promise<Map<string, VariationReason[]>> {
    const result = new Map<string, VariationReason[]>();
    if (priors.length === 0) return result;
    const since = new Map(priors.map((p) => [p.loanId, p.frozenAt]));
    const earliest = new Date(Math.min(...priors.map((p) => p.frozenAt.getTime())));
    const loanIds = [...since.keys()];

    const [microLoans, liquidations, changes] = await Promise.all([
      db.microLoan.findMany({
        where: {
          loanId: { in: loanIds },
          status: 'DISBURSED',
          purpose: { in: ['TOPUP', 'PENALTY'] },
          disbursedAt: { gt: earliest },
        },
        select: { loanId: true, purpose: true, disbursedAt: true },
      }),
      db.repayment.findMany({
        where: { loanId: { in: loanIds }, createdAt: { gt: earliest }, paymentInflow: { source: 'LIQUIDATION' } },
        select: { loanId: true, createdAt: true },
      }),
      db.tenureChange.findMany({
        where: { loanId: { in: loanIds }, status: 'APPROVED', microLoanId: null },
        select: { id: true, loanId: true },
      }),
    ]);
    const approvals = changes.length
      ? await db.auditLog.findMany({
          where: {
            action: 'TENURE_CHANGE_APPROVED',
            entityId: { in: changes.map((c) => c.id) },
            createdAt: { gt: earliest },
          },
          select: { entityId: true, createdAt: true },
        })
      : [];
    const changeLoan = new Map(changes.map((c) => [c.id, c.loanId]));

    const add = (loanId: string, at: Date | null, reason: VariationReason) => {
      const from = since.get(loanId);
      if (!from || !at || at <= from) return;
      const reasons = result.get(loanId) ?? [];
      if (!reasons.includes(reason)) reasons.push(reason);
      result.set(loanId, reasons);
    };
    for (const m of microLoans) add(m.loanId, m.disbursedAt, m.purpose === 'TOPUP' ? 'TOPUP' : 'DEFAULT');
    for (const r of liquidations) add(r.loanId, r.createdAt, 'LIQUIDATION');
    for (const a of approvals) {
      const loanId = changeLoan.get(a.entityId);
      if (loanId) add(loanId, a.createdAt, 'TENURE_CHANGE');
    }
    return result;
  }

  // ── State ──────────────────────────────────────────────────────────────────

  private versionsKept(variation: Pick<VariationRecord, 'version' | 'noPayrollReason' | 'voucher'>): number[] {
    if (variation.version < 1) return [];
    if (lockOf(variation)) return [variation.version];
    return Array.from({ length: variation.version }, (_, index) => index + 1);
  }

  private async state(variation: VariationRecord, organizationId: string, hasLater: boolean): Promise<VariationState> {
    const lock = lockOf(variation);
    let regenerateHint = false;
    if (!lock && !hasLater) {
      const [own] = await organizationPayrollStates(this.prisma, lagosMonthOf(this.clock.now()), [organizationId]);
      regenerateHint = own?.unlocked.find((v) => v.variationId === variation.id)?.regenerateHint ?? false;
    }
    return {
      id: variation.id,
      version: variation.version,
      createdAt: variation.createdAt,
      updatedAt: variation.updatedAt,
      lock,
      regenerateHint,
      versions: this.versionsKept(variation),
    };
  }
}
