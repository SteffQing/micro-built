import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import type { MessageUser } from './interface/in-app';
import { NotificationStreamService } from './notification-stream.service';

// In-app notifications. The table records when one was read (readAt); the API keeps v1's
// isRead flag, derived from it. Every write here signals the users' open streams (NotificationStreamService), so
// notification rows are only ever written through this service.
@Injectable()
export class InappService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stream: NotificationStreamService,
  ) {}

  async messageUser(dto: MessageUser) {
    const { message, ...notify } = dto;
    await this.prisma.notification.create({
      data: { ...notify, description: message },
    });
    await this.stream.publish([dto.userId]);
  }

  /**
   * One notification per `subject` for the user: an unread one about it is replaced (a chat's replies make one
   * notification, not one each), a read one stays in the list.
   */
  async replaceUnread(dto: MessageUser & { subject: string }) {
    const { message, ...notify } = dto;
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { userId: dto.userId, subject: dto.subject, readAt: null } }),
      this.prisma.notification.create({ data: { ...notify, description: message } }),
    ]);
    await this.stream.publish([dto.userId]);
  }

  /** The user opened what `subject` is about: its notifications are read (on their other tabs too). */
  async markSubjectRead(userId: string, subject: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, subject, readAt: null },
      data: { readAt: new Date() },
    });
    if (count > 0) await this.stream.publish([userId]);
  }

  /** The same message to several users (e.g. every admin), in one insert. */
  async messageUsers(userIds: string[], dto: Omit<MessageUser, 'userId'>) {
    if (userIds.length === 0) return;
    const { message, ...notify } = dto;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ ...notify, userId, description: message })),
    });
    await this.stream.publish(userIds);
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const [rows, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          callToActionUrl: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    const notifications = rows.map(({ readAt, ...row }) => ({ ...row, isRead: readAt !== null, readAt }));
    return { notifications, unreadCount, total };
  }

  // Reading on one tab or device updates the badge on the others.
  async markAsRead(userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count > 0) await this.stream.publish([userId]);
  }

  async markAllAsRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count > 0) await this.stream.publish([userId]);
  }

  /** Remove every notification about `subject` (an admin prompt someone acted on), for everyone who has it. */
  async removeBySubject(subject: string) {
    const rows = await this.prisma.notification.findMany({ where: { subject }, select: { userId: true } });
    if (rows.length === 0) return;
    await this.prisma.notification.deleteMany({ where: { subject } });
    await this.stream.publish(rows.map((row) => row.userId));
  }
}
