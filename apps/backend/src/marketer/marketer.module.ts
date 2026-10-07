import { Module } from '@nestjs/common';
import { LoanModule } from 'src/admin/loan/loan.module';
import { RepaymentsModule } from 'src/admin/repayments/repayments.module';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { MarketerController } from './marketer.controller';
import { MarketerService } from './marketer.service';

@Module({
  imports: [DatabaseModule, LedgerModule, LoanModule, RepaymentsModule, NotificationModule],
  controllers: [MarketerController],
  providers: [MarketerService],
  exports: [MarketerService],
})
export class MarketerModule {}
