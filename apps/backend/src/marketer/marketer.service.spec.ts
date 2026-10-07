jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assetStage, loanStage, MarketerService } from './marketer.service';

const NOW = new Date('2026-10-07T10:00:00Z');
const dec = (value: number) => new Prisma.Decimal(value);

describe('MarketerService', () => {
  let prisma: {
    loan: { findFirst: jest.Mock; count: jest.Mock };
    microLoan: { findFirst: jest.Mock; count: jest.Mock };
    commodityLoan: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    admin: { findFirst: jest.Mock; findMany: jest.Mock };
    notification: { findMany: jest.Mock; groupBy: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  const cashLoans = { getAllLoans: jest.fn(), getLoan: jest.fn() };
  const assets = { getAllLoans: jest.fn(), getLoan: jest.fn() };
  const topups = { list: jest.fn(), get: jest.fn() };
  const repayments = { listDeductions: jest.fn() };
  const inapp = { messageUsers: jest.fn() };
  const mail = { sendCustomerNotification: jest.fn() };
  const clock = { now: () => NOW };
  let service: MarketerService;

  const pendingLoan = {
    id: 'LN-1',
    status: 'PENDING',
    category: 'EDUCATION',
    principal: dec(250000),
    borrower: { userId: 'MB-1', user: { name: 'Ada Obi' } },
  };
  const admins = [
    { userId: 'AD-1', role: 'ADMIN', user: { name: 'Jane Admin', email: 'jane@example.com' } },
    { userId: 'SA-1', role: 'SUPER_ADMIN', user: { name: 'Sam Boss', email: 'SA-1@system.microbuiltprime.com' } },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      loan: { findFirst: jest.fn().mockResolvedValue(pendingLoan), count: jest.fn().mockResolvedValue(1) },
      microLoan: { findFirst: jest.fn(), count: jest.fn() },
      commodityLoan: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn() },
      admin: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue(admins) },
      notification: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn().mockResolvedValue({ name: 'Mo Marketer' }) },
    };
    inapp.messageUsers.mockResolvedValue(undefined);
    mail.sendCustomerNotification.mockResolvedValue(undefined);
    service = new MarketerService(
      prisma as never,
      cashLoans as never,
      assets as never,
      topups as never,
      repayments as never,
      inapp as never,
      mail as never,
      clock as never,
    );
  });

  it('knows what each item waits for', () => {
    expect(loanStage('PENDING')).toBe('DECISION');
    expect(loanStage('APPROVED')).toBe('DISBURSEMENT');
    expect(loanStage('DISBURSED')).toBeNull();
    expect(assetStage('IN_REVIEW', 'PENDING', null)).toBe('DECISION');
    expect(assetStage('APPROVED', 'APPROVED', null)).toBe('DISBURSEMENT');
    expect(assetStage('APPROVED', 'DISBURSED', 'APPROVED')).toBe('DISBURSEMENT');
    expect(assetStage('APPROVED', 'DISBURSED', 'DISBURSED')).toBeNull();
    expect(assetStage('REJECTED', 'PENDING', null)).toBeNull();
  });

  it("lists only the marketer's customers' loans, with when each was last escalated", async () => {
    cashLoans.getAllLoans.mockResolvedValue({
      data: [
        { id: 'LN-1', status: 'PENDING' },
        { id: 'LN-2', status: 'DISBURSED' },
      ],
      meta: { total: 2, page: 1, limit: 20 },
    });
    prisma.notification.groupBy.mockResolvedValue([
      { subject: 'escalation:LOAN:LN-1:DECISION', _max: { createdAt: NOW } },
    ]);
    const result = await service.cashLoanList('MK-1', { page: 1 } as never);
    expect(cashLoans.getAllLoans).toHaveBeenCalledWith({ page: 1 }, { borrower: { accountOfficerId: 'MK-1' } });
    expect(result.data).toEqual([
      { id: 'LN-1', status: 'PENDING', stage: 'DECISION', lastEscalatedAt: NOW },
      { id: 'LN-2', status: 'DISBURSED', stage: null, lastEscalatedAt: null },
    ]);
  });

  it("hides another marketer's loan, and an asset request's private details", async () => {
    prisma.loan.count.mockResolvedValue(0);
    await expect(service.loan('MK-1', 'LN-9')).rejects.toThrow(NotFoundException);
    prisma.commodityLoan.count.mockResolvedValue(1);
    assets.getLoan.mockResolvedValue({ id: 'CL-1', privateDetails: 'Bought at ₦410,000' });
    await expect(service.assetRequest('MK-1', 'CL-1')).resolves.toEqual({ id: 'CL-1', privateDetails: null });
  });

  describe('escalate', () => {
    it('asks every admin who can decide, in-app and by email where they have a real address', async () => {
      const result = await service.escalate({ userId: 'MK-1' }, { kind: 'LOAN', id: 'LN-1', note: 'Urgent' });

      expect(prisma.loan.findFirst.mock.calls[0][0].where).toEqual({ id: 'LN-1', borrower: { accountOfficerId: 'MK-1' } });
      expect(prisma.admin.findMany.mock.calls[0][0].where.role).toEqual({ in: ['ADMIN', 'SUPER_ADMIN'] });
      expect(inapp.messageUsers).toHaveBeenCalledWith(['AD-1', 'SA-1'], {
        title: "Mo Marketer asks you to look at Ada Obi's loan",
        message: expect.stringContaining('Education loan LN-1 of'),
        callToActionUrl: '/loans/cash?loan=LN-1',
        subject: 'escalation:LOAN:LN-1:DECISION',
      });
      expect(inapp.messageUsers.mock.calls[0][1].message).toContain('waiting for approval. Their note: "Urgent"');
      expect(mail.sendCustomerNotification).toHaveBeenCalledTimes(1);
      expect(mail.sendCustomerNotification).toHaveBeenCalledWith(
        'jane@example.com',
        expect.objectContaining({ ctaUrl: expect.stringMatching(/\/loans\/cash\?loan=LN-1$/) }),
      );
      expect(result).toEqual({ sentTo: ['Jane Admin', 'Sam Boss'], skipped: [], escalatedAt: NOW });
    });

    it('asks only super admins once it waits for disbursement, and refuses to single out an admin then', async () => {
      prisma.loan.findFirst.mockResolvedValue({ ...pendingLoan, status: 'APPROVED' });
      prisma.admin.findMany.mockResolvedValue([admins[1]]);
      await service.escalate({ userId: 'MK-1' }, { kind: 'LOAN', id: 'LN-1' });
      expect(prisma.admin.findMany.mock.calls[0][0].where.role).toEqual({ in: ['SUPER_ADMIN'] });
      expect(inapp.messageUsers.mock.calls[0][1].subject).toBe('escalation:LOAN:LN-1:DISBURSEMENT');

      prisma.admin.findFirst.mockResolvedValue(admins[0]);
      await expect(service.escalate({ userId: 'MK-1' }, { kind: 'LOAN', id: 'LN-1', adminId: 'AD-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('skips admins asked in the last day, and refuses when everyone was', async () => {
      prisma.notification.findMany.mockResolvedValue([{ userId: 'AD-1' }]);
      const result = await service.escalate({ userId: 'MK-1' }, { kind: 'LOAN', id: 'LN-1' });
      expect(inapp.messageUsers).toHaveBeenCalledWith(['SA-1'], expect.anything());
      expect(result.skipped).toEqual(['Jane Admin']);
      expect(prisma.notification.findMany.mock.calls[0][0].where.createdAt).toEqual({
        gte: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
      });

      prisma.notification.findMany.mockResolvedValue([{ userId: 'AD-1' }, { userId: 'SA-1' }]);
      await expect(service.escalate({ userId: 'MK-1' }, { kind: 'LOAN', id: 'LN-1' })).rejects.toThrow(
        'You already asked everyone about this in the last 24 hours',
      );
    });

    it("refuses a decided item and another marketer's", async () => {
      prisma.loan.findFirst.mockResolvedValue({ ...pendingLoan, status: 'DISBURSED' });
      await expect(service.escalate({ userId: 'MK-1' }, { kind: 'LOAN', id: 'LN-1' })).rejects.toThrow(ConflictException);
      prisma.loan.findFirst.mockResolvedValue(null);
      await expect(service.escalate({ userId: 'MK-1' }, { kind: 'LOAN', id: 'LN-1' })).rejects.toThrow(NotFoundException);
      expect(inapp.messageUsers).not.toHaveBeenCalled();
    });

    it('still escalates when an email fails', async () => {
      mail.sendCustomerNotification.mockRejectedValue(new Error('resend down'));
      await expect(service.escalate({ userId: 'MK-1' }, { kind: 'LOAN', id: 'LN-1' })).resolves.toMatchObject({
        sentTo: ['Jane Admin', 'Sam Boss'],
      });
    });
  });
});
