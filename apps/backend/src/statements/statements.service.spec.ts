import { BadRequestException } from '@nestjs/common';
import type { AuthUser } from 'src/common/types';
import { NO_LOAN_TO_REPORT, StatementsService } from './statements.service';

const requester = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  userId: 'AD-1',
  type: 'ADMIN',
  role: 'ADMIN',
  email: 'admin@example.com',
  status: 'ACTIVE',
  twoFactorEnabled: true,
  hasPasskey: false,
  ...overrides,
});

function setup() {
  const prisma = {
    loan: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(1) },
  };
  const statements = { lines: jest.fn() };
  const clock = { now: jest.fn().mockReturnValue(new Date('2026-09-15T12:00:00Z')) };
  const queue = { generateCustomerReport: jest.fn().mockResolvedValue({ jobId: '7' }) };
  const service = new StatementsService(prisma as never, statements as never, clock as never, queue as never, {
    record: jest.fn().mockResolvedValue(undefined),
  } as never);
  return { service, prisma, statements, queue };
}

const statement = { opening: 0, debits: 0, credits: 0, closing: 0, lines: [] };

describe('StatementsService.page / range', () => {
  it('defaults to the first disbursement month … the current Lagos month', async () => {
    const { service, prisma, statements } = setup();
    // 23:30 UTC on 31 Jan is already 1 February in Lagos.
    prisma.loan.findFirst.mockResolvedValue({ disbursementDate: new Date('2026-01-31T23:30:00Z') });
    statements.lines.mockResolvedValue(statement);

    const result = await service.page('MB-1', { page: 1, limit: 20 }, 'customer');

    expect(statements.lines).toHaveBeenCalledWith(
      { customerId: 'MB-1' },
      { from: { year: 2026, month: 'FEBRUARY' }, to: { year: 2026, month: 'SEPTEMBER' } },
      'customer',
    );
    expect(result.data).toMatchObject({ from: 'FEBRUARY 2026', to: 'SEPTEMBER 2026' });
  });

  it('is the current month alone when nothing was disbursed', async () => {
    const { service } = setup();
    await expect(service.range('MB-1', {})).resolves.toEqual({
      from: { year: 2026, month: 'SEPTEMBER' },
      to: { year: 2026, month: 'SEPTEMBER' },
    });
  });

  it('keeps the given ends and pages the lines', async () => {
    const { service, prisma, statements } = setup();
    const lines = Array.from({ length: 5 }, (_, i) => ({ reference: `R${i}` }));
    statements.lines.mockResolvedValue({ ...statement, lines });

    const result = await service.page('MB-1', { from: '2026-03', to: '2026-04', page: 2, limit: 2 }, 'admin');

    expect(prisma.loan.findFirst).not.toHaveBeenCalled();
    expect(statements.lines.mock.calls[0][1]).toEqual({
      from: { year: 2026, month: 'MARCH' },
      to: { year: 2026, month: 'APRIL' },
    });
    expect(result.data.lines).toEqual([{ reference: 'R2' }, { reference: 'R3' }]);
    expect(result.meta).toEqual({ total: 5, page: 2, limit: 2 });
  });

  it('400 when from is after to', async () => {
    const { service } = setup();
    await expect(service.range('MB-1', { from: '2026-05', to: '2026-04' })).rejects.toThrow(BadRequestException);
  });
});

describe('StatementsService.request', () => {
  it("queues the file for the requester, by default as a PDF to their own email", async () => {
    const { service, queue } = setup();
    await expect(service.request('MB-1', 'report', { from: '2026-01' }, requester(), 'admin')).resolves.toEqual({
      jobId: '7',
    });
    expect(queue.generateCustomerReport).toHaveBeenCalledWith({
      customerId: 'MB-1',
      email: 'admin@example.com',
      requestedById: 'AD-1',
      audience: 'admin',
      kind: 'report',
      format: 'pdf',
      from: '2026-01',
      to: undefined,
      protect: false,
    });
  });

  it("protects a customer's own copy unless they turn it off; an admin-sent customer copy always", async () => {
    const { service, queue } = setup();
    const customer = requester({ userId: 'MB-1', type: 'CUSTOMER', role: 'CUSTOMER' });
    const protectedOf = (call: number) => queue.generateCustomerReport.mock.calls[call][0].protect;

    await service.request('MB-1', 'statement', {}, customer, 'customer');
    await service.request('MB-1', 'statement', { protect: false } as never, customer, 'customer');
    await service.request('MB-1', 'statement', { audience: 'customer', protect: false } as never, requester(), 'customer');
    await service.request('MB-1', 'statement', { protect: true } as never, requester(), 'admin');

    expect([0, 1, 2, 3].map(protectedOf)).toEqual([true, false, true, true]);
  });

  it('a phone-only customer gets the link in-app only', async () => {
    const { service, queue } = setup();
    const customer = requester({ userId: 'MB-1', type: 'CUSTOMER', role: 'CUSTOMER', email: null });
    await service.request('MB-1', 'statement', { format: 'xlsx' }, customer, 'customer');
    expect(queue.generateCustomerReport).toHaveBeenCalledWith(
      expect.objectContaining({ email: undefined, requestedById: 'MB-1', kind: 'statement', format: 'xlsx' }),
    );
  });

  it('400 when nothing was ever disbursed', async () => {
    const { service, prisma, queue } = setup();
    prisma.loan.count.mockResolvedValue(0);
    await expect(service.request('MB-1', 'report', {}, requester(), 'admin')).rejects.toThrow(
      new BadRequestException(NO_LOAN_TO_REPORT),
    );
    expect(queue.generateCustomerReport).not.toHaveBeenCalled();
  });
});
