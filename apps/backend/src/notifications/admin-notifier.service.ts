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
} as const;

/** App pages admin notifications open. */
export const ADMIN_LINKS = {
  tenureChanges: '/loans/tenure-changes',
  payrollVariations: '/admin/payroll-variations',
  customers: '/customers',
  changeRequests: '/approvals',
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
   * The prompt has been acted on (decided, withdrawn): remove it from every admin's notifications, so the
   * others don't open something that is already done.
   */
  async clear(subject: string): Promise<void> {
    await this.prisma.notification.deleteMany({ where: { subject } });
  }
}
