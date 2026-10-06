import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { comparePeriods, periodLabel } from '@microbuilt/shared';
import type { Job } from 'bull';
import { captureJobError } from 'src/common/observability';
import { MaintenanceQueueName, QueueName } from 'src/common/types/queue.interface';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { lagosMonthOf } from 'src/ledger/period';
import { ADMIN_LINKS, AdminNotifierService } from 'src/notifications/admin-notifier.service';

// Repeating housekeeping (scheduled by MaintenanceProducer).
@Processor(QueueName.maintenance)
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
    private readonly admins: AdminNotifierService,
    private readonly clock: LedgerClock,
  ) {}

  /** Keeps the Supabase project from pausing for inactivity. */
  @Process(MaintenanceQueueName.supabase_ping)
  async handleSupabasePing() {
    const res = await this.supabase.ping();

    return { ...res, time: new Date().toISOString() };
  }

  /**
   * When a month ends: if payroll is still waiting for a variation — OPEN deductions in an ended
   * month (before the current Lagos one) that hasn't been submitted — super admins are told to
   * submit the earliest (variations go in month order, and only once their month is over).
   */
  @Process(MaintenanceQueueName.variation_reminder)
  async handleVariationReminder() {
    const current = lagosMonthOf(this.clock.now());
    const waiting = await this.prisma.payrollPeriod.findMany({
      where: { variationSubmittedAt: null, deductions: { some: { status: 'OPEN' } } },
      select: { id: true, year: true, month: true },
    });
    const due = waiting.filter((period) => comparePeriods(period, current) < 0).sort(comparePeriods)[0];
    if (!due) return { reminded: false };

    const loans = await this.prisma.deduction.count({ where: { periodId: due.id, status: 'OPEN' } });
    const label = periodLabel(due);
    await this.admins.notifyAdmins(['SUPER_ADMIN'], {
      title: `Submit the ${label} variation`,
      message:
        `${loans} loan${loans === 1 ? ' is' : 's are'} waiting for the ${label} payroll variation. ` +
        'Review it and submit it so payroll deducts the right amounts.',
      ctaUrl: ADMIN_LINKS.payrollVariation,
    });
    return { reminded: true, period: label, loans };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`${job.name} (${job.id}) failed: ${error.message}`, error.stack);
    captureJobError(error, { queue: QueueName.maintenance, job: job.name, jobId: job.id });
  }
}
