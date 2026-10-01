import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import type { MessageUser } from './interface/in-app';

// In-app notifications. The table records when one was read (readAt); the API keeps v1's
// isRead flag, derived from it.
@Injectable()
export class InappService {
  constructor(private readonly prisma: PrismaService) {}

  async messageUser(dto: MessageUser) {
    const { message, ...notify } = dto;
    await this.prisma.notification.create({
      data: { ...notify, description: message },
    });
  }

  /** The same message to several users (e.g. every admin), in one insert. */
  async messageUsers(userIds: string[], dto: Omit<MessageUser, 'userId'>) {
    if (userIds.length === 0) return;
    const { message, ...notify } = dto;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ ...notify, userId, description: message })),
    });
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

  async markAsRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
