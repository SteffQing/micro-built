import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma, Settings } from '@prisma/client';
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

  constructor(private readonly prisma: PrismaService) {}

  /** The saved settings, or every value unset until a super admin saves them (never seeded). */
  async get(): Promise<SettingsValues> {
    const row = await this.prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
    return row ?? UNSET;
  }

  async update(changes: SettingsChanges): Promise<SettingsValues> {
    if (Object.values(changes).every((value) => value === undefined)) {
      throw new BadRequestException('Nothing to update');
    }
    return this.prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...changes },
      update: changes,
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
  async toggleMaintenance(): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ inMaintenance: boolean }[]>`
      INSERT INTO "Settings" ("id", "inMaintenance", "updatedAt")
      VALUES (${SETTINGS_ID}, true, now())
      ON CONFLICT ("id") DO UPDATE
        SET "inMaintenance" = NOT "Settings"."inMaintenance", "updatedAt" = now()
      RETURNING "inMaintenance"`;
    this.maintenance = null;
    return rows[0]?.inMaintenance ?? true;
  }
}
