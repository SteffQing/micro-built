import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import type { MessageUser } from './interface/in-app';
import { generateId } from 'src/common/utils';

@Injectable()
export class InappService {
  constructor(private readonly prisma: PrismaService) {}

  async messageUser(dto: MessageUser) {
    const { message, ...notify } = dto;
    const id = generateId.anyId('IA');
    await this.prisma.notification.create({
      data: { ...notify, description: message, id },
    });
  }

  async getUserNotifications(userId: string, page = 1, limit = 20) {
    const [notifications, total, unreadCount] = await Promise.all([
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
          isRead: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return { notifications, unreadCount, total };
  }

  async markAsRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
