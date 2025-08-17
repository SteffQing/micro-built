import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { SmsService } from './sms.service';
import { InappService } from './inapp.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  providers: [MailService, SmsService, InappService],
  exports: [MailService, SmsService, InappService],
  imports: [PrismaModule],
})
export class NotificationModule {}
