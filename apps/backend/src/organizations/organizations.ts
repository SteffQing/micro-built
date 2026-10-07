import { comparePeriods, periodLabel, toYm, type Period } from '@microbuilt/shared';
import { Prisma, type AdminRole, type AuditAction, type Month, type Organization } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Tx } from 'src/ledger/ledger.tx';

// Organizations (PLAN_V2 P2): an employer whose payroll deducts repayments. A payroll record gets its organization
// where it is created (onboarding, bulk import, the PAYROLL change request); after that it changes only through an
// ORGANIZATION change request, never from a voucher row.

/** The spelling kept for a name: trimmed, single spaces. */
export function organizationName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** What names are matched on: "Nigerian  Navy " and "nigerian navy" are one organization. */
export function normalizeOrganizationName(name: string): string {
  return organizationName(name).toLowerCase();
}

/** Who named a new organization: a super admin's is ACTIVE at once, anyone else's waits for one (PENDING). */
export interface OrganizationNamer {
  id: string;
  role: AdminRole;
}

/** Whether an organization this person names goes straight in (a super admin, or the platform itself). */
export function namesActiveOrganization(namer: OrganizationNamer | null): boolean {
  return !namer || namer.role === 'SUPER_ADMIN' || namer.role === 'SYSTEM';
}

/**
 * The organization with this name, created on first use with the spelling given: ACTIVE when a super admin (or the
 * platform) names it, PENDING for a super admin to approve otherwise. A name that exists is reused whatever its status.
 * INSERT … ON CONFLICT, so two transactions creating the same name never fail (a unique violation would abort the
 * surrounding transaction). `created` says whether this call made it.
 */
export async function findOrCreateOrganization(
  db: Tx,
  name: string,
  namer: OrganizationNamer | null,
): Promise<Organization & { created: boolean }> {
  const normalizedName = normalizeOrganizationName(name);
  if (!normalizedName) throw new Error('An organization needs a name');
  const id = randomUUID();
  const active = namesActiveOrganization(namer);
  await db.$executeRaw`
    INSERT INTO "Organization" ("id", "name", "normalizedName", "status", "requestedById")
    VALUES (${id}, ${organizationName(name)}, ${normalizedName}, ${active ? 'ACTIVE' : 'PENDING'}::"OrganizationStatus",
            ${active ? null : (namer?.id ?? null)})
    ON CONFLICT ("normalizedName") DO NOTHING`;
  const organization = await db.organization.findUniqueOrThrow({ where: { normalizedName } });
  return { ...organization, created: organization.id === id };
}

// ─── Where each organization's payroll stands ─────────────────────────────

export interface MonthRef {
  ym: string;
  label: string;
}

export interface UnlockedVariation extends MonthRef {
  variationId: string;
  version: number;
  updatedAt: Date;
  /** PLAN_V2 R3: generated before the organization's previous month last locked or was reverted. */
  regenerateHint: boolean;
}

export interface OrganizationPayrollState {
  id: string;
  name: string;
  /** The latest month whose variation is locked (a voucher, or no payroll). */
  latestLocked: MonthRef | null;
  /** Variations not locked yet, in month order. */
  unlocked: UnlockedVariation[];
  /** Unlocked variations whose month has ended: payroll owes their voucher. */
  awaitingVoucher: MonthRef[];
  /** The earliest month holding OPEN deductions of the organization's loans: the next variation to generate. */
  toGenerate: MonthRef | null;
}

/** What moves a month's settlement: what the regenerate hint (R3) compares a later variation against. */
export const LOCK_EVENTS: AuditAction[] = ['VOUCHER_UPLOADED', 'NO_PAYROLL', 'VOUCHER_REVERTED', 'NO_PAYROLL_REVERTED'];

export function monthRef(period: Period): MonthRef {
  return { ym: toYm(period), label: periodLabel(period) };
}

/**
 * Each organization's payroll state as of `now` (a Lagos month), A–Z; only `organizationIds` when given. A variation
 * is locked when it has a voucher or a noPayrollReason (PLAN_V2 §0.2).
 */
export async function organizationPayrollStates(
  db: Tx,
  now: Period,
  organizationIds?: string[],
): Promise<OrganizationPayrollState[]> {
  const scope = organizationIds ? { id: { in: organizationIds } } : {};
  const organizations = await db.organization.findMany({
    where: scope,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  if (organizations.length === 0) return [];
  const ids = organizations.map((o) => o.id);

  const variations = await db.variation.findMany({
    where: { organizationId: { in: ids } },
    select: {
      id: true,
      organizationId: true,
      version: true,
      updatedAt: true,
      noPayrollReason: true,
      voucher: { select: { id: true, createdAt: true } },
      period: { select: { year: true, month: true } },
    },
  });
  // When each variation last locked or was reverted. The audit entries name the variation (NO_PAYROLL*,
  // VOUCHER_REVERTED) or, for a voucher that finished processing, the voucher (VOUCHER_UPLOADED).
  const variationOf = new Map<string, string>();
  for (const { id, voucher } of variations) {
    variationOf.set(id, id);
    if (voucher) variationOf.set(voucher.id, id);
  }
  const events = variations.length
    ? await db.auditLog.findMany({
        where: { action: { in: LOCK_EVENTS }, entityId: { in: [...variationOf.keys()] } },
        select: { entityId: true, createdAt: true },
      })
    : [];
  const lastEvent = new Map<string, Date>();
  for (const { entityId, createdAt } of events) {
    const id = variationOf.get(entityId);
    if (!id) continue;
    const seen = lastEvent.get(id);
    if (!seen || createdAt > seen) lastEvent.set(id, createdAt);
  }

  const toGenerate = await db.$queryRaw<{ organizationId: string; year: number; month: Month }[]>`
    SELECT DISTINCT ON (cp."organizationId") cp."organizationId", p."year", p."month"
    FROM "Deduction" d
    JOIN "Period" p ON p."id" = d."periodId"
    JOIN "Loan" l ON l."id" = d."loanId"
    JOIN "Customer" c ON c."userId" = l."borrowerId"
    JOIN "CustomerPayroll" cp ON cp."externalId" = c."externalId"
    WHERE d."status" = 'OPEN' AND cp."organizationId" IN (${Prisma.join(ids)})
    ORDER BY cp."organizationId", p."year", p."month"`;
  const nextByOrganization = new Map(toGenerate.map((row) => [row.organizationId, monthRef(row)]));

  return organizations.map(({ id, name }) => {
    const own = variations.filter((v) => v.organizationId === id).sort((a, b) => comparePeriods(a.period, b.period));
    const locked = own.filter((v) => v.voucher || v.noPayrollReason !== null);
    const unlocked: UnlockedVariation[] = [];
    own.forEach((variation, index) => {
      if (variation.voucher || variation.noPayrollReason !== null) return;
      const previous = index > 0 ? own[index - 1] : null;
      const moved = previous ? previousSettlement(previous, lastEvent.get(previous.id)) : null;
      unlocked.push({
        variationId: variation.id,
        ...monthRef(variation.period),
        version: variation.version,
        updatedAt: variation.updatedAt,
        regenerateHint: moved !== null && variation.updatedAt < moved,
      });
    });
    const latest = locked.at(-1);
    return {
      id,
      name,
      latestLocked: latest ? monthRef(latest.period) : null,
      unlocked,
      awaitingVoucher: own
        .filter((v) => !v.voucher && v.noPayrollReason === null && comparePeriods(v.period, now) < 0)
        .map((v) => monthRef(v.period)),
      toGenerate: nextByOrganization.get(id) ?? null,
    };
  });
}

/** When the previous month last locked or was reverted: its latest lock event, its voucher, or its no payroll. */
function previousSettlement(
  previous: { updatedAt: Date; noPayrollReason: string | null; voucher: { createdAt: Date } | null },
  event: Date | undefined,
): Date | null {
  const times = [event, previous.voucher?.createdAt, previous.noPayrollReason !== null ? previous.updatedAt : undefined]
    .filter((time): time is Date => time instanceof Date)
    .map((time) => time.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
}

// ─── Merging ──────────────────────────────────────────────────────────────

export interface MergeVariation {
  organizationId: string;
  period: Period;
  /** A voucher or a no payroll. */
  locked: boolean;
}

/**
 * Why `source` can't be folded into `into`, or null when it can. The merged organization has to stay what any single
 * one is (PLAN_V2 P8, P9, R1), because its variations move with it:
 * - one variation per month;
 * - no variation still waiting for its voucher behind a locked one (vouchers go in month order);
 * - no OPEN deduction in a month it already has a variation for, unless that is its latest and still unlocked
 *   (generating it again takes the row in): the next month's generation refuses while an earlier month has OPEN rows,
 *   and nothing could ever freeze these.
 * `earliestOpen` is the earliest month holding OPEN deductions of each one's loans.
 */
export function mergeBlocker(input: {
  source: { id: string; name: string };
  into: { id: string; name: string };
  variations: MergeVariation[];
  earliestOpen: { source: Period | null; into: Period | null };
}): string | null {
  const { source, into, variations, earliestOpen } = input;
  const nameOf = (organizationId: string) => (organizationId === source.id ? source.name : into.name);

  const intoMonths = new Set(variations.filter((v) => v.organizationId === into.id).map((v) => toYm(v.period)));
  const clashes = variations.filter((v) => v.organizationId === source.id && intoMonths.has(toYm(v.period)));
  if (clashes.length) {
    return (
      `${source.name} and ${into.name} both have a variation for ${clashes.map((v) => periodLabel(v.period)).join(', ')}, ` +
      'so they can’t be merged'
    );
  }

  const ordered = [...variations].sort((a, b) => comparePeriods(a.period, b.period));
  const latestLocked = ordered.findLast((v) => v.locked);
  const behind = latestLocked && ordered.find((v) => !v.locked && comparePeriods(v.period, latestLocked.period) < 0);
  if (latestLocked && behind) {
    return (
      `${nameOf(behind.organizationId)}’s ${periodLabel(behind.period)} variation is still waiting for its voucher, but ` +
      `${nameOf(latestLocked.organizationId)}’s ${periodLabel(latestLocked.period)} one is locked, and vouchers go in ` +
      'month order. Finish the earlier month first'
    );
  }

  const latest = ordered.at(-1);
  if (latest) {
    for (const side of [source, into]) {
      const open = side.id === source.id ? earliestOpen.source : earliestOpen.into;
      if (!open) continue;
      const order = comparePeriods(open, latest.period);
      if (order < 0 || (order === 0 && latest.locked)) {
        return (
          `${side.name}’s loans have deductions waiting for ${periodLabel(open)}, but ${nameOf(latest.organizationId)} ` +
          `already has its ${periodLabel(latest.period)} variation${latest.locked ? ' locked' : ''}, so they could ` +
          'never be generated for the merged organization'
        );
      }
    }
  }
  return null;
}
