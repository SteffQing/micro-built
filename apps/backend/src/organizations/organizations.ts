import type { Organization } from '@prisma/client';
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

/**
 * The organization with this name, created on first use with the spelling given. INSERT … ON CONFLICT, so two
 * transactions creating the same name never fail (a unique violation would abort the surrounding transaction).
 */
export async function findOrCreateOrganization(db: Tx, name: string): Promise<Organization> {
  const normalizedName = normalizeOrganizationName(name);
  if (!normalizedName) throw new Error('An organization needs a name');
  await db.$executeRaw`
    INSERT INTO "Organization" ("id", "name", "normalizedName")
    VALUES (${randomUUID()}, ${organizationName(name)}, ${normalizedName})
    ON CONFLICT ("normalizedName") DO NOTHING`;
  return db.organization.findUniqueOrThrow({ where: { normalizedName } });
}
