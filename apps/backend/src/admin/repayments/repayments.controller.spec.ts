jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
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
  hasPasskey: false,
};

describe('RepaymentsController', () => {
  const service = {
    list: jest.fn(),
    listDeductions: jest.fn(),
    listApplied: jest.fn(),
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

  it('has no close-period route any more: a voucher settles its variation', () => {
    expect(Object.getOwnPropertyNames(RepaymentsController.prototype)).not.toContain('closePeriod');
  });

  it('flags an applied overpayment that still needs a refund', async () => {
    service.resolve.mockResolvedValue({ state: 'REVIEWING' });
    const res = await controller.resolveRepayment('IN-1', { action: 'APPLY', customerId: 'MB-1' }, admin);
    expect(service.resolve).toHaveBeenCalledWith('IN-1', { action: 'APPLY', customerId: 'MB-1' }, 'AD-1');
    expect(res.message).toContain('still needs a refund');
  });

  it('says when the penalty for the missing row was cleared, or why it stays', async () => {
    service.resolve.mockResolvedValue({ state: 'SETTLED', penaltyCleared: true, fallbackReason: null });
    const cleared = await controller.resolveRepayment('IN-1', { action: 'APPLY', customerId: 'MB-1' }, admin);
    expect(cleared.message).toBe('The payment has been resolved and the penalty for the missing row cleared');

    service.resolve.mockResolvedValue({
      state: 'SETTLED',
      penaltyCleared: false,
      fallbackReason: 'Part of the penalty has already been collected, so the penalty stays',
    });
    const kept = await controller.resolveRepayment('IN-1', { action: 'APPLY', customerId: 'MB-1' }, admin);
    expect(kept.message).toBe(
      'The payment has been resolved: Part of the penalty has already been collected, so the penalty stays',
    );
  });
});
