import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { parseYm, toYm } from '@microbuilt/shared';
import type { Job } from 'bull';
import { captureJobError } from 'src/common/observability';
import { MaintenanceQueueName, QueueName } from 'src/common/types/queue.interface';
import { CalloutsService } from 'src/callouts/callouts.service';
import { SupportSweepService } from 'src/support/support-sweep.service';
import { PrismaService } from 'src/database/prisma.service';
import { SupabaseService } from 'src/database/supabase.service';
import { LedgerClock } from 'src/ledger/ledger.clock';
import { lagosMonthOf } from 'src/ledger/period';
import { ADMIN_LINKS, AdminNotifierService } from 'src/notifications/admin-notifier.service';
import { organizationPayrollStates, type MonthRef } from 'src/organizations/organizations';

// Repeating housekeeping (scheduled by MaintenanceProducer).
@Processor(QueueName.maintenance)
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
    private readonly admins: AdminNotifierService,
    private readonly clock: LedgerClock,
    private readonly callouts: CalloutsService,
    private readonly support: SupportSweepService,
  ) {}

  /** A callout's 7 days are up (queued when it was created or renewed). */
  @Process(MaintenanceQueueName.callout_expire)
  async handleCalloutExpire(job: Job<{ calloutId: string }>) {
    return { deleted: await this.callouts.deleteExpired(job.data.calloutId) };
  }

  /** Catches any callout whose expiry job Redis lost. */
  @Process(MaintenanceQueueName.callout_sweep)
  async handleCalloutSweep() {
    return { deleted: await this.callouts.deleteExpired() };
  }

  /** A support conversation's idle check (C9): closes it, or queues the next check 24 hours after its last message. */
  @Process(MaintenanceQueueName.support_close)
  async handleSupportClose(job: Job<{ conversationId: string }>) {
    return { result: await this.support.closeIfIdle(job.data.conversationId) };
  }

  /** A closed support conversation's 7 days are up. */
  @Process(MaintenanceQueueName.support_delete)
  async handleSupportDelete(job: Job<{ conversationId: string }>) {
    return { deleted: await this.support.deleteIfDue(job.data.conversationId) };
  }

  /** Daily: support conversations whose own job Redis lost. */
  @Process(MaintenanceQueueName.support_sweep)
  async handleSupportSweep() {
    return await this.support.catchUp();
  }

  /** Keeps the Supabase project from pausing for inactivity. */
  @Process(MaintenanceQueueName.supabase_ping)
  async handleSupabasePing() {
    const res = await this.supabase.ping();

    return { ...res, time: new Date().toISOString() };
  }

  /**
   * When a month ends, per organization (PLAN_V2 Stage D): super admins are told which variation is due (the earliest
   * month with OPEN deductions never generated: variations go in month order) and which generated months have no
   * voucher yet, with No payroll as the way out when none will come. Months still running are left alone.
   */
  @Process(MaintenanceQueueName.variation_reminder)
  async handleVariationReminder() {
    const current = lagosMonthOf(this.clock.now());
    const states = await organizationPayrollStates(this.prisma, current);
    const ended = (month: MonthRef) => month.ym < toYm(current);

    const generate: { organization: string; period: string; loans: number }[] = [];
    const vouchers: { organization: string; period: string }[] = [];
    for (const organization of states) {
      const due = organization.toGenerate;
      if (due && ended(due)) {
        const { year, month } = parseYm(due.ym);
        const loans = await this.prisma.deduction.count({
          where: {
            status: 'OPEN',
            period: { year, month },
            loan: { borrower: { payroll: { organizationId: organization.id } } },
          },
        });
        await this.admins.notifyAdmins(['SUPER_ADMIN'], {
          title: `Generate ${organization.name}’s ${due.label} variation`,
          message:
            `${loans} loan${loans === 1 ? '' : 's'} of ${organization.name} ${loans === 1 ? 'is' : 'are'} waiting ` +
            `for the ${due.label} payroll variation. Generate it so payroll deducts the right amounts.`,
          ctaUrl: ADMIN_LINKS.variation(organization.id, due.ym),
        });
        generate.push({ organization: organization.name, period: due.label, loans });
      }

      for (const month of organization.awaitingVoucher) {
        await this.admins.notifyAdmins(['SUPER_ADMIN'], {
          title: `${organization.name}: no voucher for ${month.label}`,
          message:
            `The ${month.label} variation was sent to payroll and the month has ended, but no voucher has come in. ` +
            'Upload it when payroll sends it. If none will come, mark the month No payroll: everyone in it is then penalized.',
          ctaUrl: ADMIN_LINKS.variation(organization.id, month.ym),
        });
        vouchers.push({ organization: organization.name, period: month.label });
      }
    }
    if (generate.length === 0 && vouchers.length === 0) return { reminded: false };
    return { reminded: true, generate, vouchers };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`${job.name} (${job.id}) failed: ${error.message}`, error.stack);
    captureJobError(error, { queue: QueueName.maintenance, job: job.name, jobId: job.id });
  }
}
