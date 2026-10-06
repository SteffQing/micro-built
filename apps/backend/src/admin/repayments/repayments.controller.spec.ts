jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
import { PayrollVariationController } from './payroll-variation.controller';
import { RepaymentsController } from './repayments.controller';
import type { RepaymentsService } from './repayments.service';
import type { AuthUser } from 'src/common/types';

const admin: AuthUser = {
  userId: 'AD-1',
  type: 'ADMIN',
  role: 'SUPER_ADMIN',
  email: 'admin@microbuilt.com',
  status: 'ACTIVE',
  twoFactorEnabled: true,
};

describe('RepaymentsController', () => {
  const service = {
    list: jest.fn(),
    listDeductions: jest.fn(),
    listApplied: jest.fn(),
    closePeriod: jest.fn(),
    resolve: jest.fn(),
  };
  const controller = new RepaymentsController(service as unknown as RepaymentsService);

  it('wraps the list with pagination meta', async () => {
    service.list.mockResolvedValue({ rows: [{ id: 'IN-1' }], total: 31 });
    await expect(controller.getRepayments({ page: 2, limit: 10 })).resolves.toEqual({
      data: [{ id: 'IN-1' }],
      message: 'Repayments fetched successfully',
      meta: { total: 31, page: 2, limit: 10 },
    });
  });

  it('wraps the deductions and applied lists with pagination meta', async () => {
    service.listDeductions.mockResolvedValue({ rows: [{ id: 'D-1' }], total: 3 });
    await expect(controller.getDeductions({})).resolves.toEqual({
      data: [{ id: 'D-1' }],
      message: 'Deductions fetched successfully',
      meta: { total: 3, page: 1, limit: 20 },
    });
    service.listApplied.mockResolvedValue({ rows: [{ id: 'RP-1' }], total: 12 });
    await expect(controller.getApplied({ page: 2, limit: 5 })).resolves.toEqual({
      data: [{ id: 'RP-1' }],
      message: 'Applied repayments fetched successfully',
      meta: { total: 12, page: 2, limit: 5 },
    });
  });

  it('declares the literal list routes before :id', () => {
    const names = Object.getOwnPropertyNames(RepaymentsController.prototype);
    expect(names.indexOf('getDeductions')).toBeLessThan(names.indexOf('getRepayment'));
    expect(names.indexOf('getApplied')).toBeLessThan(names.indexOf('getRepayment'));
  });


  it('says when a close has to be run again', async () => {
    service.closePeriod.mockResolvedValue({ label: 'JUNE 2026', closed: false, errors: [{}, {}] });
    const res = await controller.closePeriod({ period: '2026-06' }, admin);
    expect(service.closePeriod).toHaveBeenCalledWith('2026-06', 'AD-1');
    expect(res.message).toBe('JUNE 2026 is not closed yet: 2 deductions could not be closed. Run the close again.');
  });

  it('flags an applied overpayment that still needs a refund', async () => {
    service.resolve.mockResolvedValue({ state: 'REVIEWING' });
    const res = await controller.resolveRepayment('IN-1', { action: 'APPLY', customerId: 'MB-1' }, admin);
    expect(service.resolve).toHaveBeenCalledWith('IN-1', { action: 'APPLY', customerId: 'MB-1' }, 'AD-1');
    expect(res.message).toContain('still needs a refund');
  });
});

describe('PayrollVariationController', () => {
  const service = { generateVariationDraft: jest.fn() };
  const controller = new PayrollVariationController(service as unknown as RepaymentsService);

  it("always sends the draft to the admin's own email", async () => {
    service.generateVariationDraft.mockResolvedValue({ period: 'JUNE 2026', email: 'admin@microbuilt.com' });
    await controller.generate({ period: '2026-06' }, admin);
    expect(service.generateVariationDraft).toHaveBeenCalledWith('2026-06', 'admin@microbuilt.com', 'AD-1');
  });
});
