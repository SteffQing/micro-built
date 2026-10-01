import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { captureJobError } from 'src/common/observability';
import { MaintenanceService } from './queue.maintenance';
import { MaintenanceProducer } from './queue.producer';

jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));

const period = (month: string, year = 2026) => ({ id: `p-${month}`, year, month });

function setup(waiting: ReturnType<typeof period>[], now = new Date('2026-10-25T08:00:00Z')) {
  const prisma = {
    payrollPeriod: { findMany: jest.fn().mockResolvedValue(waiting) },
    deduction: { count: jest.fn().mockResolvedValue(42) },
  };
  const admins = { notifyAdmins: jest.fn() };
  const service = new MaintenanceService({} as never, prisma as never, admins as never, { now: () => now } as never);
  return { prisma, admins, service };
}

describe('MaintenanceService.handleVariationReminder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks super admins to submit the current month while payroll waits for it', async () => {
    const { prisma, admins, service } = setup([period('NOVEMBER'), period('OCTOBER')]);
    await expect(service.handleVariationReminder()).resolves.toEqual({
      reminded: true,
      period: 'OCTOBER 2026',
      loans: 42,
    });
    expect(prisma.payrollPeriod.findMany).toHaveBeenCalledWith({
      where: { variationSubmittedAt: null, deductions: { some: { status: 'OPEN' } } },
      select: { id: true, year: true, month: true },
    });
    expect(prisma.deduction.count).toHaveBeenCalledWith({ where: { periodId: 'p-OCTOBER', status: 'OPEN' } });
    expect(admins.notifyAdmins).toHaveBeenCalledWith(['SUPER_ADMIN'], {
      title: 'Submit the OCTOBER 2026 variation',
      message: expect.stringContaining('42 loans are waiting for the OCTOBER 2026 payroll variation'),
      ctaUrl: '/admin/payroll-variations',
    });
  });

  it('names an earlier month still waiting first, since variations go in month order', async () => {
    const { admins, service } = setup([period('OCTOBER'), period('SEPTEMBER')]);
    await service.handleVariationReminder();
    expect(admins.notifyAdmins).toHaveBeenCalledWith(
      ['SUPER_ADMIN'],
      expect.objectContaining({ title: 'Submit the SEPTEMBER 2026 variation' }),
    );
  });

  it('stays quiet once the current month has gone (only later months are open)', async () => {
    const { admins, service } = setup([period('NOVEMBER')]);
    await expect(service.handleVariationReminder()).resolves.toEqual({ reminded: false });
    expect(admins.notifyAdmins).not.toHaveBeenCalled();
  });

  it('reports a failed job', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service } = setup([]);
    const error = new Error('storage is down');
    service.onFailed({ name: 'supabase_ping', id: 7 } as unknown as Job, error);
    expect(captureJobError).toHaveBeenCalledWith(error, { queue: 'maintenance', job: 'supabase_ping', jobId: 7 });
  });
});

describe('MaintenanceProducer', () => {
  it('replaces its schedules on boot, adds the variation reminder and drops v1’s auto-report', async () => {
    const queue = {
      getRepeatableJobs: jest.fn().mockResolvedValue([
        { name: 'supabase_ping', key: 'ping-key' },
        { name: 'variation_reminder', key: 'old-reminder-key' },
        { name: 'auto-generate-missing-reports', key: 'v1-key' },
        { name: 'something_else', key: 'other-key' },
      ]),
      removeRepeatableByKey: jest.fn(),
      add: jest.fn(),
    };
    await new MaintenanceProducer(queue as unknown as Queue).onModuleInit();

    expect(queue.removeRepeatableByKey.mock.calls.map(([key]) => key)).toEqual([
      'ping-key',
      'old-reminder-key',
      'v1-key',
    ]);
    expect(queue.add).toHaveBeenCalledWith(
      'supabase_ping',
      {},
      { repeat: { cron: '0 0 */3 * *' }, jobId: 'supabase-keep-alive', removeOnComplete: true, removeOnFail: true },
    );
    expect(queue.add).toHaveBeenCalledWith(
      'variation_reminder',
      {},
      {
        repeat: { cron: '0 9 25 * *', tz: 'Africa/Lagos' },
        jobId: 'variation-reminder',
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  });

  it('lets the app boot when Redis refuses, and reports it', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const queue = { getRepeatableJobs: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    await expect(new MaintenanceProducer(queue as unknown as Queue).onModuleInit()).resolves.toBeUndefined();
    expect(captureJobError).toHaveBeenCalledWith(expect.any(Error), { queue: 'maintenance', job: 'schedule' });
  });
});
