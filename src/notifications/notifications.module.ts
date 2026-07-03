import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { SmsService } from './sms.service';
import { InappService } from './inapp.service';
import { CustomerNotifierService } from './customer-notifier.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  providers: [MailService, SmsService, InappService, CustomerNotifierService],
  exports: [MailService, SmsService, InappService, CustomerNotifierService],
  imports: [DatabaseModule],
})
export class NotificationModule {}
