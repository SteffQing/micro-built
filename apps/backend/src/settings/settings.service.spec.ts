import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AuditService } from 'src/audit/audit.service';
import type { PrismaService } from 'src/database/prisma.service';
import { toSettingsChanges, toSettingsDto, UpdateSettingsDto } from './dto/settings.dto';
import { fromPercent, toPercent } from './rates';
import { PENALTY_RATE_NOT_SET, RATES_NOT_SET, SettingsService } from './settings.service';

const decimal = (value: string) => new Prisma.Decimal(value);

function setup(row: Record<string, unknown> | null) {
  const prisma = {
    settings: {
      findUnique: jest.fn().mockResolvedValue(row),
      upsert: jest.fn(async ({ update }: { update: object }) => ({ ...row, ...update })),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ inMaintenance: true }]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((work: (tx: unknown) => Promise<unknown>) => work(prisma));
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new SettingsService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { prisma, audit, service };
}

const saved = {
  id: 1,
  interestRate: decimal('0.06'),
  managementFeeRate: decimal('0.025'),
  penaltyRate: decimal('0.1'),
  maxDeductionRate: null,
  inMaintenance: false,
};

describe('SettingsService', () => {
  it('reports every value unset until settings are saved (they are never seeded)', async () => {
    const { service } = setup(null);
    expect(await service.get()).toEqual({
      interestRate: null,
      managementFeeRate: null,
      penaltyRate: null,
      maxDeductionRate: null,
      inMaintenance: false,
    });
  });

  it('refuses to price a loan until both rates are set', async () => {
    await expect(setup(null).service.requireRates()).rejects.toThrow(new ConflictException(RATES_NOT_SET));
    await expect(setup({ ...saved, managementFeeRate: null }).service.requireRates()).rejects.toThrow(
      ConflictException,
    );
    const rates = await setup(saved).service.requireRates();
    expect(rates.interestRate.toString()).toBe('0.06');
    expect(rates.managementFeeRate.toString()).toBe('0.025');
  });

  it('refuses to charge penalties until the penalty rate is set', async () => {
    await expect(setup({ ...saved, penaltyRate: null }).service.requirePenaltyRate()).rejects.toThrow(
      new ConflictException(PENALTY_RATE_NOT_SET),
    );
    expect((await setup(saved).service.requirePenaltyRate()).toString()).toBe('0.1');
  });

  it('upserts only the fields sent, and rejects an empty update', async () => {
    const { prisma, service } = setup(saved);
    await expect(service.update({}, 'super-1')).rejects.toThrow(BadRequestException);
    await service.update({ interestRate: decimal('0.05') }, 'super-1');
    expect(prisma.settings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      create: { id: 1, interestRate: decimal('0.05') },
      update: { interestRate: decimal('0.05') },
    });
  });

  it('audits each changed rate with its before and after, in the same transaction', async () => {
    const { prisma, audit, service } = setup(saved);
    await service.update({ interestRate: decimal('0.05'), penaltyRate: decimal('0.1') }, 'super-1');
    expect(audit.record).toHaveBeenCalledWith(
      {
        actorId: 'super-1',
        action: 'SETTINGS_UPDATED',
        entityType: 'SETTINGS',
        entityId: '1',
        note: 'interestRate',
        meta: { before: { interestRate: 0.06 }, after: { interestRate: 0.05 } },
      },
      prisma,
    );
  });

  it('does not audit an update that changes nothing', async () => {
    const { audit, service } = setup(saved);
    await service.update({ interestRate: decimal('0.06') }, 'super-1');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('caches maintenance mode briefly and drops the cache when it is toggled', async () => {
    const { prisma, service } = setup(saved);
    expect(await service.inMaintenance()).toBe(false);
    expect(await service.inMaintenance()).toBe(false);
    expect(prisma.settings.findUnique).toHaveBeenCalledTimes(1);

    expect(await service.toggleMaintenance('super-1')).toBe(true);
    prisma.settings.findUnique.mockResolvedValue({ ...saved, inMaintenance: true });
    expect(await service.inMaintenance()).toBe(true);
    expect(prisma.settings.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('rates', () => {
  it('stores fractions and exchanges percentages', () => {
    expect(toPercent(decimal('0.0525'))).toBe(5.25);
    expect(toPercent(null)).toBeNull();
    expect(fromPercent(5.25).toString()).toBe('0.0525');
    expect(fromPercent(33.33).toString()).toBe('0.3333');
  });

  it('turns a request into changes, keeping unsent fields out and null as "no cap"', () => {
    const changes = toSettingsChanges({ interestRate: 6, maxDeductionRate: null });
    expect(changes.interestRate?.toString()).toBe('0.06');
    expect(changes.managementFeeRate).toBeUndefined();
    expect(changes.maxDeductionRate).toBeNull();
    expect(toSettingsDto({ ...saved, maxDeductionRate: decimal('0.4') })).toMatchObject({
      interestRate: 6,
      managementFeeRate: 2.5,
      penaltyRate: 10,
      maxDeductionRate: 40,
    });
  });
});

describe('UpdateSettingsDto', () => {
  const errorsFor = async (body: object) =>
    (await validate(plainToInstance(UpdateSettingsDto, body))).map((error) => error.property);

  it('accepts percentages with up to 2 decimals and null for the cap only', async () => {
    expect(await errorsFor({ interestRate: 5.25, penaltyRate: 0, maxDeductionRate: null })).toEqual([]);
    expect(await errorsFor({ maxDeductionRate: 33.33 })).toEqual([]);
  });

  it('rejects unsetting a rate, too many decimals and out-of-range values', async () => {
    expect(await errorsFor({ interestRate: null })).toEqual(['interestRate']);
    expect(await errorsFor({ managementFeeRate: 2.555 })).toEqual(['managementFeeRate']);
    expect(await errorsFor({ penaltyRate: 101 })).toEqual(['penaltyRate']);
    expect(await errorsFor({ maxDeductionRate: 0 })).toEqual(['maxDeductionRate']);
  });
});
