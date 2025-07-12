import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { InviteAdminDto } from './common/dto';
import { generateCode, generateId } from 'src/common/utils';
import { MailService } from 'src/mail/mail.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async upgradeUserToAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
    });
  }

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
    });

    if (existing) throw new ConflictException('Email already exists');

    const password = generateCode.generatePassword();
    const hash = await bcrypt.hash(password, 10);

    const adminId = generateId.adminId();
    await this.prisma.user.create({
      data: {
        id: adminId,
        email,
        password: hash,
        status: 'ACTIVE',
        role: 'ADMIN',
        name: dto.name,
      },
    });

    await this.mail.sendAdminInvite(email, dto.name, password, adminId);
  }
}
