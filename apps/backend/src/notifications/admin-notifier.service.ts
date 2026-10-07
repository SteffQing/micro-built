import { Injectable } from '@nestjs/common';
import type { AdminRole } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { SYSTEM_ACTOR_ID } from 'src/ledger/ledger.constants';
import { InappService } from './inapp.service';

export interface AdminNotification {
  title: string;
  message: string;
  /** The app page it opens (ADMIN_LINKS). */
  ctaUrl?: string;
  /** What it is about, e.g. `liquidation:<inflowId>`; `clear(subject)` removes it once someone acts on it. */
  subject?: string;
}

/** Subjects of admin prompts, one per thing an admin has to act on. */
export const NOTIFICATION_SUBJECT = {
  liquidation: (inflowId: string) => `liquidation:${inflowId}`,
  changeRequest: (requestId: string) => `change-request:${requestId}`,
  tenureChange: (changeId: string) => `tenure-change:${changeId}`,
  organization: (organizationId: string) => `organization:${organizationId}`,
  /** A marketer asked admins to move a loan, asset request or top-up on, at one stage (decision, disbursement). */
  escalation: (kind: string, id: string, stage: string) => `escalation:${kind}:${id}:${stage}`,
} as const;

/** App pages admin notifications open. */
export const ADMIN_LINKS = {
  tenureChanges: '/loans/tenure-changes',
  customers: '/customers',
  changeRequests: '/approvals',
  /** The variations page (generate, download, vouchers, no payroll). */
  payrollVariation: '/variations',
  // Deep links: the page opens (or filters to) this one item.
  /** One organization's variations page, on a month (`YYYY-MM`) when given. */
  variation: (organizationId: string, ym?: string) =>
    `/variations?organizationId=${encodeURIComponent(organizationId)}${ym ? `&period=${ym}` : ''}`,
  changeRequest: (id: string) => `/approvals?request=${id}`,
  tenureChange: (id: string) => `/loans/tenure-changes?change=${id}`,
  inflow: (id: string) => `/repayments?tab=inflows&inflow=${id}`,
  voucher: (id: string) => `/repayments?tab=inflows&voucher=${id}`,
  /** A loan (cash or asset), open on the Cash Loans page. */
  loan: (id: string) => `/loans/cash?loan=${id}`,
  /** A cash top-up, open on the Top-ups page. */
  topup: (id: string) => `/loans/topups?topup=${id}`,
  /** An asset request (a new asset loan or an asset top-up), open on the Asset Loans page. */
  assetRequest: (id: string) => `/loans/commodity?request=${id}`,
  /** One organization's page (approve, rename, merge). */
  organization: (id: string) => `/organizations/${id}`,
} as const;

// Notifications for the people running the platform: in-app only (admins work in the dashboard).
@Injectable()
export class AdminNotifierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inapp: InappService,
  ) {}

  /** One notification to every active admin holding one of `roles` — never the system actor. */
  async notifyAdmins(roles: AdminRole[], notification: AdminNotification): Promise<void> {
    const wanted = roles.filter((role) => role !== 'SYSTEM');
    if (wanted.length === 0) return;
    const admins = await this.prisma.admin.findMany({
      where: { role: { in: wanted }, userId: { not: SYSTEM_ACTOR_ID }, user: { status: 'ACTIVE' } },
      select: { userId: true },
    });
    await this.inapp.messageUsers(
      admins.map((admin) => admin.userId),
      {
        title: notification.title,
        message: notification.message,
        callToActionUrl: notification.ctaUrl,
        subject: notification.subject,
      },
    );
  }

  /**
   * A new organization an admin or marketer named is waiting for a super admin to approve it (or merge it into the
   * one it misspelt). Best effort: after the commit, never failing the caller.
   */
  async organizationAwaitingApproval(organization: { id: string; name: string; requestedById: string | null }) {
    const requester = organization.requestedById
      ? await this.prisma.user.findUnique({ where: { id: organization.requestedById }, select: { name: true } })
      : null;
    await this.notifyAdmins(['SUPER_ADMIN'], {
      title: 'New organization waiting for approval',
      message:
        `${requester?.name ?? 'An admin'} added ${organization.name}. Approve it, or merge it into the organization it ` +
        'was meant to be. Its variations can’t be generated until then.',
      ctaUrl: ADMIN_LINKS.organization(organization.id),
      subject: NOTIFICATION_SUBJECT.organization(organization.id),
    });
  }

  /**
   * The prompt has been acted on (decided, withdrawn): remove it from every admin's notifications, so the
   * others don't open something that is already done.
   */
  async clear(subject: string): Promise<void> {
    await this.inapp.removeBySubject(subject);
  }

  /** A loan, asset request or top-up was decided or disbursed: a marketer's escalations about it are done. */
  async clearEscalations(kind: 'LOAN' | 'ASSET_REQUEST' | 'TOPUP', id: string): Promise<void> {
    await Promise.all(
      (['DECISION', 'DISBURSEMENT'] as const).map((stage) => this.clear(NOTIFICATION_SUBJECT.escalation(kind, id, stage))),
    );
  }

  /**
   * A loan or top-up was decided or disbursed: its escalations are done, and so are those of the asset request it
   * opened or pays for (an approved asset request is paid out on its loan or top-up, not on itself).
   */
  async clearPayoutEscalations(kind: 'LOAN' | 'TOPUP', id: string): Promise<void> {
    const requests = await this.prisma.commodityLoan.findMany({
      where: kind === 'LOAN' ? { loanId: id } : { microLoanId: id },
      select: { id: true },
    });
    await Promise.all([
      this.clearEscalations(kind, id),
      ...requests.map((request) => this.clearEscalations('ASSET_REQUEST', request.id)),
    ]);
  }
}
