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
}

/** App pages admin notifications open. */
export const ADMIN_LINKS = {
  tenureChanges: '/admin/tenure-changes',
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
      { title: notification.title, message: notification.message, callToActionUrl: notification.ctaUrl },
    );
  }
}
