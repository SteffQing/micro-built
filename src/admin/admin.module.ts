import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { ConfigModule } from 'src/config/config.module';

@Module({
  imports: [PrismaModule, MailModule, ConfigModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
