import { ValidationPipe } from '@nestjs/common';
import { ManualRepaymentResolutionDto } from './repayment.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validate = <T>(metatype: new () => T, value: object, type: 'body' | 'query' = 'query'): Promise<T> =>
  pipe.transform(value, { type, metatype }) as Promise<T>;

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
