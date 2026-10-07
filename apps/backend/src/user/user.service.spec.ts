import { Prisma } from '@prisma/client';
import { UserService } from './user.service';

function setup() {
  const prisma = { customer: { findUnique: jest.fn() } };
  const service = new UserService(prisma as never, {} as never);
  return { prisma, service };
}

describe('UserService.getPayroll', () => {
  it('gives the organization’s name and its id, so the customer page can link and filter on it', async () => {
    const { prisma, service } = setup();
    prisma.customer.findUnique.mockResolvedValue({
      payroll: {
        externalId: 'PF1',
        netPay: new Prisma.Decimal('180000.50'),
        employeeGross: new Prisma.Decimal('240000'),
        grade: 'L12',
        step: null,
        command: 'Lagos Command',
        organizationId: 'ORG-NPF',
        organization: { name: 'NPF' },
      },
    });

    await expect(service.getPayroll('MB-1')).resolves.toEqual({
      message: 'User payroll data found',
      data: {
        externalId: 'PF1',
        netPay: 180000.5,
        employeeGross: 240000,
        grade: 'L12',
        step: undefined,
        command: 'Lagos Command',
        organization: 'NPF',
        organizationId: 'ORG-NPF',
      },
    });
    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { userId: 'MB-1' },
      select: { payroll: { include: { organization: { select: { name: true } } } } },
    });
  });

  it('is null until the customer has a payroll record', async () => {
    const { prisma, service } = setup();
    prisma.customer.findUnique.mockResolvedValue({ payroll: null });
    await expect(service.getPayroll('MB-1')).resolves.toEqual({ message: 'User payroll data not found', data: null });
  });
});
