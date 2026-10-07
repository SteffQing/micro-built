import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';
import { captureJobError } from 'src/common/observability';
import { organizationPayrollStates } from 'src/organizations/organizations';
import { MaintenanceService } from './queue.maintenance';
import { MaintenanceProducer } from './queue.producer';

jest.mock('src/common/observability', () => ({ captureJobError: jest.fn() }));
jest.mock('src/organizations/organizations', () => ({ organizationPayrollStates: jest.fn() }));

const month = (ym: string, label: string) => ({ ym, label });
const OCTOBER = month('2026-10', 'OCTOBER 2026');
const SEPTEMBER = month('2026-09', 'SEPTEMBER 2026');
const NOVEMBER = month('2026-11', 'NOVEMBER 2026');

/** An organization's payroll state; only what the reminder reads matters. */
const state = (name: string, over: { toGenerate?: ReturnType<typeof month> | null; awaitingVoucher?: ReturnType<typeof month>[] }) => ({
  id: `ORG-${name}`,
  name,
  latestLocked: null,
  unlocked: [],
  awaitingVoucher: over.awaitingVoucher ?? [],
  toGenerate: over.toGenerate ?? null,
});

function setup(states: ReturnType<typeof state>[], now = new Date('2026-11-01T08:00:00Z')) {
  jest.mocked(organizationPayrollStates).mockResolvedValue(states);
  const prisma = { deduction: { count: jest.fn().mockResolvedValue(42) } };
  const admins = { notifyAdmins: jest.fn() };
  const service = new MaintenanceService({} as never, prisma as never, admins as never, { now: () => now } as never);
  return { prisma, admins, service };
}

describe('MaintenanceService.handleVariationReminder', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks super admins to generate the month just ended for an organization whose deductions were never generated', async () => {
    const { prisma, admins, service } = setup([state('Navy', { toGenerate: OCTOBER })]);
    await expect(service.handleVariationReminder()).resolves.toEqual({
      reminded: true,
      generate: [{ organization: 'Navy', period: 'OCTOBER 2026', loans: 42 }],
      vouchers: [],
    });
    expect(organizationPayrollStates).toHaveBeenCalledWith(prisma, { year: 2026, month: 'NOVEMBER' });
    expect(prisma.deduction.count).toHaveBeenCalledWith({
      where: {
        status: 'OPEN',
        period: { year: 2026, month: 'OCTOBER' },
        loan: { borrower: { payroll: { organizationId: 'ORG-Navy' } } },
      },
    });
    expect(admins.notifyAdmins).toHaveBeenCalledWith(['SUPER_ADMIN'], {
      title: 'Generate Navy’s OCTOBER 2026 variation',
      message: expect.stringContaining('42 loans of Navy are waiting for the OCTOBER 2026 payroll variation'),
      ctaUrl: '/variations?organizationId=ORG-Navy&period=2026-10',
    });
  });

  it('reminds each organization on its own, naming the earliest month it still owes', async () => {
    const { admins, service } = setup([
      state('Navy', { toGenerate: SEPTEMBER }),
      state('Police', { toGenerate: OCTOBER }),
      state('Army', {}),
    ]);
    await service.handleVariationReminder();
    expect(admins.notifyAdmins).toHaveBeenCalledTimes(2);
    expect(admins.notifyAdmins).toHaveBeenCalledWith(
      ['SUPER_ADMIN'],
      expect.objectContaining({ title: 'Generate Navy’s SEPTEMBER 2026 variation' }),
    );
    expect(admins.notifyAdmins).toHaveBeenCalledWith(
      ['SUPER_ADMIN'],
      expect.objectContaining({ title: 'Generate Police’s OCTOBER 2026 variation' }),
    );
  });

  it('says it is one loan, not "1 loans"', async () => {
    const { prisma, admins, service } = setup([state('Navy', { toGenerate: OCTOBER })]);
    prisma.deduction.count.mockResolvedValue(1);
    await service.handleVariationReminder();
    expect(admins.notifyAdmins).toHaveBeenCalledWith(
      ['SUPER_ADMIN'],
      expect.objectContaining({ message: expect.stringContaining('1 loan of Navy is waiting') }),
    );
  });

  it('suggests No payroll for a variation whose month has ended with no voucher', async () => {
    const { prisma, admins, service } = setup([state('Navy', { awaitingVoucher: [SEPTEMBER, OCTOBER] })]);
    await expect(service.handleVariationReminder()).resolves.toEqual({
      reminded: true,
      generate: [],
      vouchers: [
        { organization: 'Navy', period: 'SEPTEMBER 2026' },
        { organization: 'Navy', period: 'OCTOBER 2026' },
      ],
    });
    expect(prisma.deduction.count).not.toHaveBeenCalled();
    expect(admins.notifyAdmins).toHaveBeenCalledTimes(2);
    expect(admins.notifyAdmins).toHaveBeenCalledWith(['SUPER_ADMIN'], {
      title: 'Navy: no voucher for SEPTEMBER 2026',
      message: expect.stringContaining('mark the month No payroll'),
      ctaUrl: '/variations?organizationId=ORG-Navy&period=2026-09',
    });
  });

  it('sends both reminders for an organization that owes a voucher and a generation', async () => {
    const { admins, service } = setup([state('Navy', { toGenerate: OCTOBER, awaitingVoucher: [SEPTEMBER] })]);
    await service.handleVariationReminder();
    expect(admins.notifyAdmins.mock.calls.map(([, notification]) => notification.title)).toEqual([
      'Generate Navy’s OCTOBER 2026 variation',
      'Navy: no voucher for SEPTEMBER 2026',
    ]);
  });

  it("stays quiet about a month that hasn't ended, and when every organization is up to date", async () => {
    const { prisma, admins, service } = setup([state('Navy', { toGenerate: NOVEMBER }), state('Police', {})]);
    await expect(service.handleVariationReminder()).resolves.toEqual({ reminded: false });
    expect(prisma.deduction.count).not.toHaveBeenCalled();
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
        repeat: { cron: '0 9 1 * *', tz: 'Africa/Lagos' },
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
