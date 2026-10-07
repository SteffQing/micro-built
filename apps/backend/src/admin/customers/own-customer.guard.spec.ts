jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { OwnCustomerGuard } from './own-customer.guard';

const context = (user: { userId: string; role: string } | undefined, id?: string) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user, params: id ? { id } : {} }) }) }) as unknown as ExecutionContext;

describe('OwnCustomerGuard', () => {
  const prisma = { customer: { findFirst: jest.fn() } };
  const guard = new OwnCustomerGuard(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('lets admins through without a lookup', async () => {
    await expect(guard.canActivate(context({ userId: 'AD-1', role: 'ADMIN' }, 'MB-1'))).resolves.toBe(true);
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it("lets a marketer reach the customers they onboarded, and answers 404 for anyone else's", async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({ userId: 'MB-1' });
    await expect(guard.canActivate(context({ userId: 'MK-1', role: 'MARKETER' }, 'MB-1'))).resolves.toBe(true);
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: { userId: 'MB-1', accountOfficerId: 'MK-1' },
      select: { userId: true },
    });

    prisma.customer.findFirst.mockResolvedValueOnce(null);
    await expect(guard.canActivate(context({ userId: 'MK-1', role: 'MARKETER' }, 'MB-2'))).rejects.toThrow(
      NotFoundException,
    );
  });
});
