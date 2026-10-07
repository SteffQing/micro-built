import { ValidationPipe } from '@nestjs/common';
import {
  GenerateVariationsDto,
  VariationDraftDto,
  VariationFileQueryDto,
  VariationHistoryQueryDto,
  VariationsQueryDto,
} from './variations.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validate = <T>(metatype: new () => T, value: object, type: 'body' | 'query' = 'query'): Promise<T> =>
  pipe.transform(value, { type, metatype }) as Promise<T>;

describe('Variation preview query', () => {
  it('takes an organization and a YYYY-MM period, with an optional action and reason', async () => {
    await expect(
      validate(VariationsQueryDto, { organizationId: 'ORG-1', period: '2026-06', action: 'AMEND', reason: 'TOPUP' }),
    ).resolves.toMatchObject({ organizationId: 'ORG-1', period: '2026-06', action: 'AMEND', reason: 'TOPUP' });
    await expect(validate(VariationsQueryDto, { organizationId: 'ORG-1', period: '2026-06' })).resolves.toMatchObject({
      organizationId: 'ORG-1',
      period: '2026-06',
    });
  });

  it.each([
    { organizationId: 'ORG-1', period: 'JUNE 2026' },
    { organizationId: 'ORG-1', period: '2026-13' },
    { organizationId: 'ORG-1' },
    { period: '2026-06' },
    { organizationId: '', period: '2026-06' },
  ])('rejects %j', async (query) => {
    await expect(validate(VariationsQueryDto, query)).rejects.toThrow();
  });

  it.each([{ action: 'CHANGE' }, { reason: 'COMBINED' }])('rejects an unknown filter %j', async (filter) => {
    await expect(validate(VariationsQueryDto, { organizationId: 'ORG-1', period: '2026-06', ...filter })).rejects.toThrow();
  });
});

describe('Variation history query', () => {
  it('needs the organization', async () => {
    await expect(validate(VariationHistoryQueryDto, { organizationId: 'ORG-1' })).resolves.toMatchObject({
      organizationId: 'ORG-1',
    });
    await expect(validate(VariationHistoryQueryDto, {})).rejects.toThrow();
  });
});

describe('Generate variations body', () => {
  it('takes the organizations to generate for, or all', async () => {
    await expect(
      validate(GenerateVariationsDto, { period: '2026-10', organizationIds: ['ORG-1', 'ORG-2'] }, 'body'),
    ).resolves.toMatchObject({ period: '2026-10', organizationIds: ['ORG-1', 'ORG-2'] });
    await expect(validate(GenerateVariationsDto, { period: '2026-10', all: true }, 'body')).resolves.toMatchObject({
      all: true,
    });
  });

  it.each([
    { period: 'OCTOBER 2026', all: true },
    { organizationIds: ['ORG-1'] },
    { period: '2026-10', organizationIds: 'ORG-1' },
    { period: '2026-10', organizationIds: [''] },
    { period: '2026-10', organizationIds: [1] },
    { period: '2026-10', all: 'yes' },
  ])('rejects %j', async (body) => {
    await expect(validate(GenerateVariationsDto, body, 'body')).rejects.toThrow();
  });

  it('caps how many organizations one call may name', async () => {
    const organizationIds = Array.from({ length: 201 }, (_, index) => `ORG-${index}`);
    await expect(validate(GenerateVariationsDto, { period: '2026-10', organizationIds }, 'body')).rejects.toThrow();
  });
});

describe('Variation draft body', () => {
  it("takes an organization and a month: the draft goes to the signed-in admin's own email", async () => {
    await expect(
      validate(VariationDraftDto, { organizationId: 'ORG-1', period: '2026-06' }, 'body'),
    ).resolves.toMatchObject({ organizationId: 'ORG-1', period: '2026-06' });
    await expect(
      validate(VariationDraftDto, { organizationId: 'ORG-1', period: '2026-06', email: 'payroll@example.com' }, 'body'),
    ).rejects.toThrow();
    await expect(validate(VariationDraftDto, { period: '2026-06' }, 'body')).rejects.toThrow();
  });
});

describe('Variation file query', () => {
  it('reads the version as a number, and may leave it out', async () => {
    await expect(validate(VariationFileQueryDto, { version: '2' })).resolves.toMatchObject({ version: 2 });
    await expect(validate(VariationFileQueryDto, {})).resolves.toEqual({});
  });

  it.each([{ version: '0' }, { version: '1.5' }, { version: 'latest' }])('rejects %j', async (query) => {
    await expect(validate(VariationFileQueryDto, query)).rejects.toThrow();
  });
});
