import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { SmsService } from './sms.service';
import { SMS_PROVIDER } from './sms.provider';
import { TermiiProvider } from './sms.termii.provider';
import { InappService } from './inapp.service';
import { CustomerNotifierService } from './customer-notifier.service';
import { AdminNotifierService } from './admin-notifier.service';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  providers: [
    MailService,
    { provide: SMS_PROVIDER, useClass: TermiiProvider },
    SmsService,
    InappService,
    CustomerNotifierService,
    AdminNotifierService,
  ],
  exports: [
    MailService,
    SmsService,
    InappService,
    CustomerNotifierService,
    AdminNotifierService,
  ],
  imports: [DatabaseModule],
})
export class NotificationModule {}
