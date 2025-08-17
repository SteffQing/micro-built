import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { InviteAdminDto } from './common/dto';
import { generateCode, generateId } from 'src/common/utils';
import { MailService } from 'src/notifications/mail.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
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

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { id: adminId, role: dto.role, status: 'ACTIVE' },
      });
    } else {
      const password = generateCode.generatePassword();
      const hash = await bcrypt.hash(password, 10);

      await this.prisma.user.create({
        data: {
          id: adminId,
          email,
          password: hash,
          status: 'ACTIVE',
          role: dto.role,
          name: dto.name,
        },
      });

      await this.mail.sendAdminInvite(email, dto.name, password, adminId);
    }
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
