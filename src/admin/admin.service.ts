import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { InviteAdminDto } from './common/dto';
import { generateId } from 'src/common/utils';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminEvents } from 'src/queue/events/events';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly event: EventEmitter2,
  ) {}

  async getAllAdmins() {
    return this.prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'SUPER_ADMIN'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        avatar: true,
        name: true,
        role: true,
        email: true,
        status: true,
      },
    });
  }

  async inviteAdmin(dto: InviteAdminDto) {
    const email = dto.email;
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const adminId = generateId.adminId();

    this.event.emit(AdminEvents.adminInvite, {
      adminId,
      existing,
      ...dto,
    });
  }

  async removeAdmin(id: string) {
    const exists = await this.prisma.user.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!exists) {
      throw new NotFoundException('No Admin user found with this id');
    }

    const userId = generateId.userId();
    await this.prisma.user.update({
      where: { id },
      data: { id: userId, status: 'FLAGGED', role: 'CUSTOMER' },
    });

    return { data: null, message: `${exists.name} has been removed` };
  }
}
