import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from 'src/auth/auth.module';
import { SettingsModule } from 'src/settings/settings.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { DatabaseModule } from 'src/database/database.module';
import { LoanModule } from './loan/loan.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CustomersModule } from './customers/customers.module';
import { RepaymentsModule } from './repayments/repayments.module';

@Module({
  imports: [
    AuthModule,
    SettingsModule,
    LedgerModule,
    NotificationModule,
    DatabaseModule,
    LoanModule,
    DashboardModule,
    CustomersModule,
    RepaymentsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
