import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { QueueModule } from 'src/queue/bull/queue.module';
import { RepaymentsConsumer } from 'src/queue/bull/queue.repayments';
import { SettingsModule } from 'src/settings/settings.module';
import { NoPayrollController } from './no-payroll.controller';
import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';
import { VouchersController } from './vouchers.controller';
import { VouchersService } from './vouchers.service';

// The repayments queue's consumer lives here, with the code it runs (QueueModule only registers the queues).
// NoPayrollController shares the /admin/variations prefix with the variations module's own controller: Nest merges them.
@Module({
  imports: [AuthModule, LedgerModule, SettingsModule, QueueModule, NotificationModule, DatabaseModule],
  controllers: [VouchersController, NoPayrollController, RepaymentsController],
  providers: [RepaymentsService, VouchersService, RepaymentsConsumer],
  exports: [RepaymentsService],
})
export class RepaymentsModule {}
