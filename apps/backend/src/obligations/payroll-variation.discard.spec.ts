import { BadRequestException, ConflictException } from '@nestjs/common';
import { PayrollVariationService } from './payroll-variation.service';

// Preparing an official variation freezes the month. Discarding must undo
// exactly that, and nothing more.
describe('PayrollVariationService.discard', () => {
  const period = new Date('2026-08-31T23:00:00.000Z');
  const preparedBatch = (overrides: Record<string, unknown> = {}) => ({
    id: 'VAR-1',
    period,
    version: 1,
    kind: 'VARIATION',
    status: 'PREPARED',
    internalScheduleId: 'SCH-1',
    rows: [],
    ...overrides,
  });

  function build(batch: unknown, schedule: unknown = null) {
    const tx = {
      $executeRaw: jest.fn(),
      payrollVariationBatch: {
        findUnique: jest.fn().mockResolvedValue(batch),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockImplementation(({ data }) => ({
          ...(batch as Record<string, unknown>),
          ...data,
          rows: [],
        })),
      },
      payrollSchedule: {
        findUnique: jest.fn().mockResolvedValue(schedule),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      payrollScheduleRow: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { installmentId: 'INS-1' },
            { installmentId: 'INS-2' },
          ]),
      },
      repaymentInstallment: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(0),
      },
      config: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
    };
    const service = new PayrollVariationService(
      prisma as never,
      {} as never,
    );
    return { service, tx };
  }

  const schedule = {
    id: 'SCH-1',
    period,
    status: 'PUBLISHED',
    supersedesScheduleId: null as string | null,
  };

  it('reopens the month the preparation froze', async () => {
    const { service, tx } = build(preparedBatch(), schedule);

    const result = await service.discard('VAR-1', ' bounced, never sent ', 'MB-1');

    expect(tx.repaymentInstallment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['INS-1', 'INS-2'] }, status: 'PUBLISHED' },
      data: { status: 'PLANNED' },
    });
    expect(tx.payrollSchedule.update).toHaveBeenCalledWith({
      where: { id: 'SCH-1' },
      data: {
        status: 'CANCELLED',
        officialPeriod: null,
        publishedAt: null,
        publishedBy: null,
      },
    });
    expect(tx.payrollVariationBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DISCARDED',
          discardedBy: 'MB-1',
          discardReason: 'bounced, never sent',
        }),
      }),
    );
    expect(result.reopenedInstallments).toBe(2);
    expect(result.monthReopened).toBe(true);
  });

  it('restores the submission the preparation superseded', async () => {
    // Otherwise a month whose earlier submission was real is left wrongly open.
    const { service, tx } = build(preparedBatch(), {
      ...schedule,
      supersedesScheduleId: 'SCH-0',
    });

    await service.discard('VAR-1', 'replaced in error', 'MB-1');

    expect(tx.payrollSchedule.update).toHaveBeenCalledWith({
      where: { id: 'SCH-0' },
      data: { status: 'PUBLISHED', officialPeriod: period },
    });
  });

  it('leaves the month frozen when another batch still relies on the snapshot', async () => {
    const { service, tx } = build(preparedBatch(), schedule);
    tx.payrollVariationBatch.count.mockResolvedValue(1);
    tx.payrollSchedule.count.mockResolvedValue(1);

    const result = await service.discard('VAR-1', 'superseded', 'MB-1');

    expect(tx.payrollSchedule.update).not.toHaveBeenCalled();
    expect(tx.repaymentInstallment.updateMany).not.toHaveBeenCalled();
    expect(result.monthReopened).toBe(false);
  });

  it('refuses to discard a confirmed submission', async () => {
    const { service } = build(preparedBatch({ status: 'SENT' }), schedule);
    await expect(service.discard('VAR-1', 'oops', 'MB-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses to discard a draft', async () => {
    const { service } = build(preparedBatch({ status: 'DRAFT' }), schedule);
    await expect(service.discard('VAR-1', 'oops', 'MB-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('requires a reason', async () => {
    const { service } = build(preparedBatch(), schedule);
    await expect(service.discard('VAR-1', '   ', 'MB-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('preserves the whole snapshot when any installment carries repayment activity', async () => {
    const { service, tx } = build(preparedBatch(), schedule);
    tx.repaymentInstallment.count.mockResolvedValue(1);
    tx.payrollSchedule.count.mockResolvedValue(1);

    const result = await service.discard('VAR-1', 'never sent', 'MB-1');

    expect(tx.payrollSchedule.update).not.toHaveBeenCalled();
    expect(tx.repaymentInstallment.updateMany).not.toHaveBeenCalled();
    expect(result.status).toBe('DISCARDED');
    expect(result.monthReopened).toBe(false);
    expect(result.reopenedInstallments).toBe(0);
  });

  it.each(['ACKNOWLEDGED', 'CLOSED'])('keeps a %s schedule frozen', async (status) => {
    const { service, tx } = build(preparedBatch(), { ...schedule, status });
    tx.payrollSchedule.count.mockResolvedValue(1);

    const result = await service.discard('VAR-1', 'file abandoned', 'MB-1');

    expect(tx.payrollSchedule.update).not.toHaveBeenCalled();
    expect(tx.repaymentInstallment.updateMany).not.toHaveBeenCalled();
    expect(result.monthReopened).toBe(false);
  });

  it('does not reopen a period already closed by repayment processing', async () => {
    const { service, tx } = build(preparedBatch(), schedule);
    tx.config.findUnique.mockResolvedValue({ value: period.toISOString() });

    const result = await service.discard('VAR-1', 'file abandoned', 'MB-1');

    expect(tx.payrollSchedule.update).not.toHaveBeenCalled();
    expect(tx.repaymentInstallment.updateMany).not.toHaveBeenCalled();
    expect(result.monthReopened).toBe(false);
  });
});
