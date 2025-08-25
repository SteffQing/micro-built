import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { SmsService } from './sms.service';
import { InappService } from './inapp.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  providers: [MailService, SmsService, InappService],
  exports: [MailService, SmsService, InappService],
  imports: [DatabaseModule],
})
export class NotificationModule {}
