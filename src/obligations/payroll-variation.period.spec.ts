import { BadRequestException, ConflictException } from '@nestjs/common';
import { PayrollVariationService } from './payroll-variation.service';

describe('Variation calendar-month restriction', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-14T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  function build() {
    const tx = {
      $executeRaw: jest.fn(),
      payrollVariationState: { findUnique: jest.fn().mockResolvedValue(null) },
      payrollVariationBatch: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'FUTURE', status: 'PREPARED', period: new Date('2026-09-30T23:00:00Z'),
          artifactHash: 'file', emailedAt: new Date(), rows: [],
        }),
        update: jest.fn(),
      },
    };
    const service = new PayrollVariationService({
      $transaction: (fn: (client: unknown) => unknown) => fn(tx),
    } as never, {} as never);
    return { service, tx };
  }

  it.each(['OCTOBER 2026', 'JANUARY 2027'])('rejects %s during September', async (period) => {
    const { service, tx } = build();
    await expect(service.preview(period)).rejects.toThrow(BadRequestException);
    expect(tx.payrollVariationState.findUnique).not.toHaveBeenCalled();
  });

  it.each(['SEPTEMBER 2026', 'AUGUST 2026'])('lets %s proceed to normal eligibility checks', async (period) => {
    const { service, tx } = build();
    await expect(service.preview(period)).rejects.toThrow(ConflictException);
    expect(tx.payrollVariationState.findUnique).toHaveBeenCalled();
  });

  it.each([
    ['2026-09-30T22:59:59.999Z', 'OCTOBER 2026'],
    ['2026-12-31T22:59:59.999Z', 'JANUARY 2027'],
  ])('unlocks the next month at midnight Lagos time after %s', async (instant, period) => {
    const { service, tx } = build();
    jest.setSystemTime(new Date(instant));
    await expect(service.preview(period)).rejects.toThrow('future month');
    expect(tx.payrollVariationState.findUnique).not.toHaveBeenCalled();
    jest.setSystemTime(new Date(new Date(instant).getTime() + 1));
    await expect(service.preview(period)).rejects.toThrow(ConflictException);
    expect(tx.payrollVariationState.findUnique).toHaveBeenCalled();
  });

  it('cannot confirm a future preparation saved before this restriction', async () => {
    const { service, tx } = build();
    await expect(service.confirmSent('FUTURE', 'Test receipt', 'ADMIN')).rejects.toThrow('future month');
    expect(tx.payrollVariationBatch.update).not.toHaveBeenCalled();
  });
});
