import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { QueueModule } from 'src/queue/bull/queue.module';
import { RepaymentsConsumer } from 'src/queue/bull/queue.repayments';
import { SettingsModule } from 'src/settings/settings.module';
import { PayrollUploadController } from './payroll-upload.controller';
import { PayrollUploadService } from './payroll-upload.service';
import { PayrollVariationController } from './payroll-variation.controller';
import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';

// The repayments queue's consumer lives here, with the code it runs (QueueModule only registers
// the queues). PayrollUploadController comes first so its literal `upload` and `validate` paths
// are matched before RepaymentsController's `:id` routes.
@Module({
  imports: [LedgerModule, SettingsModule, QueueModule, NotificationModule, DatabaseModule],
  controllers: [PayrollUploadController, RepaymentsController, PayrollVariationController],
  providers: [RepaymentsService, PayrollUploadService, RepaymentsConsumer],
  exports: [RepaymentsService],
})
export class RepaymentsModule {}
