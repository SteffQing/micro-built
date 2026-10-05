import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma, Settings } from '@prisma/client';
import { AuditService } from 'src/audit/audit.service';
import { PrismaService } from 'src/database/prisma.service';

export type SettingsValues = Pick<
  Settings,
  'interestRate' | 'managementFeeRate' | 'penaltyRate' | 'maxDeductionRate' | 'inMaintenance'
>;
/** Rates as fractions (0.06 = 6 %); maxDeductionRate null turns the net-pay cap off. */
export type SettingsChanges = Partial<Omit<SettingsValues, 'inMaintenance'>>;

export const RATES_NOT_SET = 'Set rates in Settings first';
export const PENALTY_RATE_NOT_SET = 'Set the penalty rate in Settings first';

// The single Settings row; a CHECK in invariants.sql keeps it at id 1.
const SETTINGS_ID = 1;
const MAINTENANCE_CACHE_MS = 5_000;

const UNSET: SettingsValues = {
  interestRate: null,
  managementFeeRate: null,
  penaltyRate: null,
  maxDeductionRate: null,
  inMaintenance: false,
};

@Injectable()
export class SettingsService {
  private maintenance: { value: boolean; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The saved settings, or every value unset until a super admin saves them (never seeded). */
  async get(): Promise<SettingsValues> {
    const row = await this.prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
    return row ?? UNSET;
  }

  /** Audited with each changed rate's before and after (fractions; null = unset). */
  async update(changes: SettingsChanges, actorId: string): Promise<SettingsValues> {
    if (Object.values(changes).every((value) => value === undefined)) {
      throw new BadRequestException('Nothing to update');
    }
    return this.prisma.$transaction(async (tx) => {
      const before = (await tx.settings.findUnique({ where: { id: SETTINGS_ID } })) ?? UNSET;
      const saved = await tx.settings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, ...changes },
        update: changes,
      });
      const rate = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));
      const keys = (Object.keys(changes) as (keyof SettingsChanges)[]).filter(
        (key) => changes[key] !== undefined && rate(before[key]) !== rate(saved[key]),
      );
      if (keys.length > 0) {
        await this.audit.record(
          {
            actorId,
            action: 'SETTINGS_UPDATED',
            entityType: 'SETTINGS',
            entityId: String(SETTINGS_ID),
            note: keys.join(', '),
            meta: {
              before: Object.fromEntries(keys.map((key) => [key, rate(before[key])])),
              after: Object.fromEntries(keys.map((key) => [key, rate(saved[key])])),
            },
          },
          tx,
        );
      }
      return saved;
    });
  }

  /** The rates a loan is priced with; 409 until a super admin has set both. */
  async requireRates(): Promise<{ interestRate: Prisma.Decimal; managementFeeRate: Prisma.Decimal }> {
    const { interestRate, managementFeeRate } = await this.get();
    if (interestRate === null || managementFeeRate === null) {
      throw new ConflictException(RATES_NOT_SET);
    }
    return { interestRate, managementFeeRate };
  }

  /** Closing a period charges penalties, so it needs this rate; 409 until it is set. */
  async requirePenaltyRate(): Promise<Prisma.Decimal> {
    const { penaltyRate } = await this.get();
    if (penaltyRate === null) throw new ConflictException(PENALTY_RATE_NOT_SET);
    return penaltyRate;
  }

  /** Checked on every write request by the maintenance guard, so cached briefly. */
  async inMaintenance(): Promise<boolean> {
    const now = Date.now();
    if (this.maintenance && this.maintenance.expiresAt > now) return this.maintenance.value;
    const { inMaintenance } = await this.get();
    this.maintenance = { value: inMaintenance, expiresAt: now + MAINTENANCE_CACHE_MS };
    return inMaintenance;
  }

  /** Flips maintenance mode in one statement (two admins toggling can't both read the old value). */
  async toggleMaintenance(actorId: string): Promise<boolean> {
    const on = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ inMaintenance: boolean }[]>`
        INSERT INTO "Settings" ("id", "inMaintenance", "updatedAt")
        VALUES (${SETTINGS_ID}, true, now())
        ON CONFLICT ("id") DO UPDATE
          SET "inMaintenance" = NOT "Settings"."inMaintenance", "updatedAt" = now()
        RETURNING "inMaintenance"`;
      const value = rows[0]?.inMaintenance ?? true;
      await this.audit.record(
        {
          actorId,
          action: 'MAINTENANCE_TOGGLED',
          entityType: 'SETTINGS',
          entityId: String(SETTINGS_ID),
          note: value ? 'Maintenance on' : 'Maintenance off',
        },
        tx,
      );
      return value;
    });
    this.maintenance = null;
    return on;
  }
}
