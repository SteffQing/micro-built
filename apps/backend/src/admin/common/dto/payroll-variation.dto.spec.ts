import { ValidationPipe } from '@nestjs/common';
import { PayrollVariationPreviewDto } from './payroll-variation.dto';
import { GenerateMonthlyLoanScheduleDto } from './superadmin.dto';
import { PayrollVariationFilter } from 'src/common/types/report.interface';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
describe('Payroll variation filter API validation', () => {
  it.each(Object.values(PayrollVariationFilter))(
    'accepts %s for preview and generation',
    async (changeFilter) => {
      const input = { period: 'SEPTEMBER 2026', changeFilter };
      const preview = await pipe.transform(input, {
        type: 'body',
        metatype: PayrollVariationPreviewDto,
      });
      expect(preview.changeFilter).toBe(changeFilter);
      const generation = await pipe.transform(
        { ...input, email: 'payroll@example.com', previewHash: 'reviewed' },
        { type: 'body', metatype: GenerateMonthlyLoanScheduleDto },
      );
      expect(generation.changeFilter).toBe(changeFilter);
    },
  );
  it.each(['UNKNOWN', ['TOPUP', 'LIQUIDATION'], 7])(
    'rejects an invalid filter %j',
    async (changeFilter) => {
      await expect(
        pipe.transform(
          { period: 'SEPTEMBER 2026', changeFilter },
          { type: 'body', metatype: PayrollVariationPreviewDto },
        ),
      ).rejects.toThrow();
    },
  );
  it('keeps clients that omit the filter valid', async () => {
    await expect(
      pipe.transform(
        { period: 'SEPTEMBER 2026' },
        { type: 'body', metatype: PayrollVariationPreviewDto },
      ),
    ).resolves.toMatchObject({ period: 'SEPTEMBER 2026' });
  });
});
