import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { TenureChangeReason } from '@prisma/client';
import { captureJobError } from 'src/common/observability';
import { formatCurrency } from 'src/common/utils';
import { PrismaService } from 'src/database/prisma.service';
import { LedgerEvents, type LedgerEventName, type LedgerEventPayloads } from 'src/ledger/ledger.events';
import { ADMIN_LINKS, AdminNotifierService } from 'src/notifications/admin-notifier.service';
import { CustomerNotifierService } from 'src/notifications/customer-notifier.service';

type Payload<K extends LedgerEventName> = LedgerEventPayloads[K];

/** The admins who decide tenure changes (V2.MD §0.4-2). */
const TENURE_DECIDERS = ['ADMIN', 'SUPER_ADMIN'] as const;

/** Why a change was proposed, for the admins deciding it; an admin's own change needs no reason. */
const PROPOSAL_REASON: Record<TenureChangeReason, string> = {
  DEFAULT: ' after a missed deduction put the monthly amount above the net-pay cap',
  TOPUP: ' with a top-up request; it is decided with the top-up',
  LIQUIDATION: ' after a liquidation',
  ADMIN: '',
};

const months = (count: number) => `${count} month${count === 1 ? '' : 's'}`;

function reasonText(note: string | undefined): string {
  return note?.trim() ? ` Reason: ${note.trim()}` : ' Please contact support for more details.';
}

// Tells people what the ledger did. The ledger emits only after its transaction commits, so a
// listener never sees money that was rolled back. Listeners only send notifications (no other
// writes), and a failed one is logged and reported, never thrown: the money has already moved.
@Injectable()
export class LedgerListeners {
  private readonly logger = new Logger(LedgerListeners.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomerNotifierService,
    private readonly admins: AdminNotifierService,
  ) {}

  @OnEvent(LedgerEvents.loanDisbursed)
  async loanDisbursed(event: Payload<'loan.disbursed'>): Promise<void> {
    const monthly =
      event.monthly > 0 ? ` ${formatCurrency(event.monthly)} will be deducted from your salary each month.` : '';
    await this.send(LedgerEvents.loanDisbursed, () =>
      this.customers.notify(event.borrowerId, {
        title: 'Loan Disbursed',
        message: `Your loan of ${formatCurrency(event.principal)} has been disbursed.${monthly}`,
      }),
    );
  }

  @OnEvent(LedgerEvents.topupDecided)
  async topupDecided(event: Payload<'topup.decided'>): Promise<void> {
    const amount = formatCurrency(event.amount);
    await this.send(LedgerEvents.topupDecided, () =>
      this.customers.notify(
        event.borrowerId,
        event.approved
          ? {
              title: 'Top-up Approved',
              message: `Your top-up request of ${amount} has been approved. We will let you know when it is disbursed.`,
            }
          : {
              title: 'Top-up Rejected',
              message: `Your top-up request of ${amount} has been rejected.${reasonText(event.note)}`,
            },
      ),
    );
  }

  @OnEvent(LedgerEvents.topupDisbursed)
  async topupDisbursed(event: Payload<'topup.disbursed'>): Promise<void> {
    const monthly = event.monthly > 0 ? ` Your monthly deduction is now ${formatCurrency(event.monthly)}.` : '';
    await this.send(LedgerEvents.topupDisbursed, () =>
      this.customers.notify(event.borrowerId, {
        title: 'Top-up Disbursed',
        message: `Your top-up of ${formatCurrency(event.amount)} has been disbursed.${monthly}`,
      }),
    );
  }

  @OnEvent(LedgerEvents.penaltyApplied)
  async penaltyApplied(event: Payload<'penalty.applied'>): Promise<void> {
    const detail = event.note ? ` (${event.note})` : '';
    await this.send(LedgerEvents.penaltyApplied, () =>
      this.customers.notify(event.borrowerId, {
        title: 'Penalty Applied',
        message:
          `A penalty of ${formatCurrency(event.amount)} has been added to your loan for a missed or short ` +
          `repayment${detail}. Your remaining monthly deductions now include it.`,
      }),
    );
  }

  /**
   * To every admin who can decide it: who proposed what, and why. Not once it's decided (an admin
   * can propose and apply in one call): the approval is announced instead.
   */
  @OnEvent(LedgerEvents.tenureChangeProposed)
  async tenureChangeProposed(event: Payload<'tenure-change.proposed'>): Promise<void> {
    await this.send(LedgerEvents.tenureChangeProposed, async () => {
      const [change, customer] = await Promise.all([
        this.prisma.tenureChange.findUnique({
          where: { id: event.changeId },
          select: { status: true, requestedBy: { select: { user: { select: { name: true } } } } },
        }),
        this.customerName(event.borrowerId),
      ]);
      if (change && change.status !== 'PENDING') return;
      // A top-up's change with no admin on it was asked for by the customer; any other, by the system.
      const proposer =
        change?.requestedBy?.user.name ??
        (event.reason === 'TOPUP' ? 'The customer' : event.bySystem ? 'The system' : 'An admin');
      const direction = event.monthsDelta > 0 ? 'extending' : 'shortening';
      await this.admins.notifyAdmins([...TENURE_DECIDERS], {
        title: 'Tenure Change Proposed',
        message:
          `${proposer} proposed ${direction} ${customer}'s loan by ${months(Math.abs(event.monthsDelta))}` +
          `${PROPOSAL_REASON[event.reason]}.`,
        ctaUrl: ADMIN_LINKS.tenureChanges,
      });
    });
  }

  /** The customer always; the deciding admins too when the loan got longer ("duration increased"). */
  @OnEvent(LedgerEvents.tenureChangeApproved)
  async tenureChangeApproved(event: Payload<'tenure-change.approved'>): Promise<void> {
    const change = months(Math.abs(event.monthsDelta));
    const verb = event.monthsDelta > 0 ? 'extended' : 'shortened';
    await this.send(LedgerEvents.tenureChangeApproved, () =>
      this.customers.notify(event.borrowerId, {
        title: 'Loan Tenure Updated',
        message:
          `Your loan tenure has been ${verb} by ${change} and is now ${months(event.tenure)}. ` +
          'Your monthly deduction has been adjusted to match.',
      }),
    );
    if (event.monthsDelta <= 0) return;
    await this.send(LedgerEvents.tenureChangeApproved, async () => {
      const customer = await this.customerName(event.borrowerId);
      await this.admins.notifyAdmins([...TENURE_DECIDERS], {
        title: 'Loan Duration Increased',
        message: `${customer}'s loan was extended by ${change} and now runs ${months(event.tenure)}.`,
        ctaUrl: ADMIN_LINKS.tenureChanges,
      });
    });
  }

  /**
   * Nobody is told: the customer never asked for a proposal the admins turned down, and a change
   * requested with a top-up is decided, and announced, with it (topup.decided).
   */
  @OnEvent(LedgerEvents.tenureChangeRejected)
  tenureChangeRejected(): void {
    // Intentionally silent.
  }

  @OnEvent(LedgerEvents.loanRepaid)
  async loanRepaid(event: Payload<'loan.repaid'>): Promise<void> {
    await this.send(LedgerEvents.loanRepaid, () =>
      this.customers.notify(event.borrowerId, {
        title: 'Loan Fully Repaid',
        message: 'Congratulations! Your loan has been fully repaid. Thank you for choosing MicroBuilt.',
      }),
    );
  }

  @OnEvent(LedgerEvents.liquidationDecided)
  async liquidationDecided(event: Payload<'liquidation.decided'>): Promise<void> {
    const amount = formatCurrency(event.amount);
    await this.send(LedgerEvents.liquidationDecided, () =>
      this.customers.notify(
        event.borrowerId,
        event.approved
          ? {
              title: 'Loan Liquidation Approved',
              message: `Your loan liquidation of ${amount} has been approved and applied to your outstanding loan balance.`,
            }
          : {
              title: 'Loan Liquidation Rejected',
              message: `Your loan liquidation request of ${amount} has been rejected.${reasonText(event.note)}`,
            },
      ),
    );
  }

  private async customerName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return user?.name ?? 'A customer';
  }

  /** Sends one notification; whatever goes wrong is logged and reported, never thrown. */
  private async send(event: LedgerEventName, notify: () => Promise<unknown>): Promise<void> {
    try {
      await notify();
    } catch (error) {
      this.logger.error(`Notification for ${event} failed`, error instanceof Error ? error.stack : String(error));
      captureJobError(error, { queue: 'events', job: event });
    }
  }
}
