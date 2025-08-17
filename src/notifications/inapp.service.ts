import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
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
}
