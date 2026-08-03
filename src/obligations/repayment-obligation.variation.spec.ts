import { BadRequestException, ConflictException } from '@nestjs/common';
import { InstallmentStatus, PlanStatus, Prisma } from '@prisma/client';
import { VariationScheduleMode } from 'src/common/types/report.interface';
import { RepaymentObligationService } from './repayment-obligation.service';

describe('RepaymentObligationService variation lifecycle', () => {
  const official = {
    id: 'SCH-AUGUST-OFFICIAL',
    version: 1,
    status: 'PUBLISHED',
    artifactHash: 'original-hash',
    artifactUrl: '2026/AUGUST/SCH-AUGUST-OFFICIAL-published.xlsx',
    rows: [
      {
        id: 'ROW-LYDIA',
        installmentId: 'INS-AUGUST-LYDIA',
        obligationId: 'OBL-LYDIA',
        externalId: 'PF0162389',
        borrowerName: 'AHIMAS LYDIA',
        command: 'ADAMAWA STATE COMMAND',
        contractualOutstanding: new Prisma.Decimal('171861.11'),
        penaltyOutstanding: new Prisma.Decimal(0),
        totalOutstanding: new Prisma.Decimal('171861.11'),
        amount: new Prisma.Decimal('21482.64'),
        termRemaining: 8,
        startDate: new Date('2026-07-31T23:00:00.000Z'),
        endDate: new Date('2027-03-31T22:59:59.999Z'),
      },
    ],
  };

  it('reproduces an official month instead of mixing in later account state', async () => {
    const prisma = {
      payrollSchedule: {
        findFirst: jest.fn().mockResolvedValue(official),
      },
      $transaction: jest.fn(),
    };
    const service = new RepaymentObligationService(prisma as any);

    const result = await service.prepareVariationSchedule(
      'AUGUST 2026',
      'ADMIN-1',
      VariationScheduleMode.DRAFT,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        scheduleId: official.id,
        status: 'PUBLISHED',
        artifactHash: 'original-hash',
      }),
    );
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        externalId: 'PF0162389',
        contractualOutstanding: 171861.11,
        expected: 21482.64,
        tenure: 8,
      }),
    );
  });

  it('requires an audit note before an official payroll submission', async () => {
    const service = new RepaymentObligationService({} as any);

    await expect(
      service.prepareVariationSchedule(
        'AUGUST 2026',
        'SUPER-1',
        VariationScheduleMode.SUBMIT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps an earlier valid installment after a later plan supersedes its parent', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      payrollSchedule: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (callback) =>
        callback({ repaymentInstallment: { findMany } }),
      ),
    };
    const service = new RepaymentObligationService(prisma as any);

    await expect(
      service.prepareVariationSchedule(
        'AUGUST 2026',
        'ADMIN-1',
        VariationScheduleMode.DRAFT,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              status: InstallmentStatus.PLANNED,
              plan: {
                status: {
                  in: [PlanStatus.PUBLISHED, PlanStatus.SUPERSEDED],
                },
              },
            },
          ]),
        }),
      }),
    );
  });

  it('applies a pre-submission top-up to the current open payroll month', async () => {
    const prisma = {
      payrollSchedule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new RepaymentObligationService(prisma as any);

    const period = await (service as any).nextUnpublishedPeriod(
      new Date('2026-07-26T12:00:00.000Z'),
    );

    expect(period.toISOString()).toBe('2026-06-30T23:00:00.000Z');
  });

  it('moves a post-submission top-up to the next open payroll month', async () => {
    const prisma = {
      payrollSchedule: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { period: new Date('2026-06-30T23:00:00.000Z') },
          ]),
      },
    };
    const service = new RepaymentObligationService(prisma as any);

    const period = await (service as any).nextUnpublishedPeriod(
      new Date('2026-07-26T12:00:00.000Z'),
    );

    expect(period.toISOString()).toBe('2026-07-31T23:00:00.000Z');
  });

  it('keeps an August top-up in August while August is still a draft', async () => {
    const prisma = {
      payrollSchedule: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new RepaymentObligationService(prisma as any);

    const period = await (service as any).nextUnpublishedPeriod(
      new Date('2026-08-03T09:00:00.000Z'),
    );

    expect(period.toISOString()).toBe('2026-07-31T23:00:00.000Z');
  });

  it('moves an August top-up to September after August is official', async () => {
    const prisma = {
      payrollSchedule: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { period: new Date('2026-07-31T23:00:00.000Z') },
          ]),
      },
    };
    const service = new RepaymentObligationService(prisma as any);

    const period = await (service as any).nextUnpublishedPeriod(
      new Date('2026-08-03T09:00:00.000Z'),
    );

    expect(period.toISOString()).toBe('2026-08-31T23:00:00.000Z');
  });

  it('does not skip the current open month when a later month is official', async () => {
    const prisma = {
      payrollSchedule: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { period: new Date('2026-08-31T23:00:00.000Z') },
          ]),
      },
    };
    const service = new RepaymentObligationService(prisma as any);

    const period = await (service as any).nextUnpublishedPeriod(
      new Date('2026-08-03T09:00:00.000Z'),
    );

    expect(period.toISOString()).toBe('2026-07-31T23:00:00.000Z');
  });

  it('rejects a different binary for an already recorded schedule artifact', async () => {
    const prisma = {
      payrollSchedule: {
        findUnique: jest.fn().mockResolvedValue({ artifactHash: 'hash-one' }),
        update: jest.fn(),
      },
    };
    const service = new RepaymentObligationService(prisma as any);

    await expect(
      service.setScheduleArtifact('SCH-1', 'hash-two'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.payrollSchedule.update).not.toHaveBeenCalled();
  });
});
