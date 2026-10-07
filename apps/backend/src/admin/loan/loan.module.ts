import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { SettingsModule } from 'src/settings/settings.module';
import { CashLoanController, CommodityLoanController } from './loan.controller';
import { CashLoanService, CommodityLoanService } from './loan.service';
import { TopupController } from './topup.controller';
import { TopupService } from './topup.service';

@Module({
  imports: [DatabaseModule, LedgerModule, SettingsModule, NotificationModule],
  controllers: [CashLoanController, CommodityLoanController, TopupController],
  providers: [CashLoanService, CommodityLoanService, TopupService],
  exports: [CashLoanService, CommodityLoanService, TopupService],
})
export class LoanModule {}
