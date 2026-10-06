import { ValidationPipe } from '@nestjs/common';
import { GenerateVariationDto, PayrollVariationPreviewDto } from './payroll-variation.dto';
import { ManualRepaymentResolutionDto } from './repayment.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validate = <T>(metatype: new () => T, value: object, type: 'body' | 'query' = 'query'): Promise<T> =>
  pipe.transform(value, { type, metatype }) as Promise<T>;

describe('Payroll variation request validation', () => {
  it('accepts a YYYY-MM period with an optional action and reason', async () => {
    await expect(
      validate(PayrollVariationPreviewDto, { period: '2026-06', action: 'AMEND', reason: 'TOPUP' }),
    ).resolves.toMatchObject({ period: '2026-06', action: 'AMEND', reason: 'TOPUP' });
    await expect(validate(PayrollVariationPreviewDto, { period: '2026-06' })).resolves.toMatchObject({
      period: '2026-06',
    });
  });

  it.each([{ period: 'JUNE 2026' }, { period: '2026-13' }, {}])('rejects period %j', async (query) => {
    await expect(validate(PayrollVariationPreviewDto, query)).rejects.toThrow();
  });

  it.each([{ action: 'CHANGE' }, { reason: 'COMBINED' }])('rejects an unknown filter %j', async (filter) => {
    await expect(validate(PayrollVariationPreviewDto, { period: '2026-06', ...filter })).rejects.toThrow();
  });

  it("generate takes only the month: the draft goes to the signed-in admin's own email", async () => {
    await expect(validate(GenerateVariationDto, { period: '2026-06' }, 'body')).resolves.toMatchObject({
      period: '2026-06',
    });
    await expect(
      validate(GenerateVariationDto, { period: '2026-06', email: 'payroll@example.com' }, 'body'),
    ).rejects.toThrow();
  });
});

describe('Manual resolution validation', () => {
  it('needs a customer to APPLY, a note is optional', async () => {
    await expect(validate(ManualRepaymentResolutionDto, { action: 'APPLY' }, 'body')).rejects.toThrow();
    await expect(
      validate(ManualRepaymentResolutionDto, { action: 'APPLY', customerId: 'MB-1' }, 'body'),
    ).resolves.toMatchObject({ action: 'APPLY', customerId: 'MB-1' });
  });

  it.each(['SETTLE', 'REJECT'])('needs a note to %s', async (action) => {
    await expect(validate(ManualRepaymentResolutionDto, { action }, 'body')).rejects.toThrow();
    await expect(validate(ManualRepaymentResolutionDto, { action, note: '   ' }, 'body')).rejects.toThrow();
    await expect(
      validate(ManualRepaymentResolutionDto, { action, note: 'Refunded by transfer' }, 'body'),
    ).resolves.toMatchObject({ action, note: 'Refunded by transfer' });
  });

  it('rejects an unknown action', async () => {
    await expect(validate(ManualRepaymentResolutionDto, { action: 'FULFIL', note: 'x' }, 'body')).rejects.toThrow();
  });
});
