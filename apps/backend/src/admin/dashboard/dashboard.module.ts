import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { SettingsModule } from 'src/settings/settings.module';
import { CustomersModule } from '../customers/customers.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [DatabaseModule, LedgerModule, SettingsModule, CustomersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
