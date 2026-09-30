import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SettingsModule } from 'src/settings/settings.module';
import { LoanModule } from './loan/loan.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CustomersModule } from './customers/customers.module';
import { RepaymentsModule } from './repayments/repayments.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [
    SettingsModule,
    LoanModule,
    DashboardModule,
    CustomersModule,
    RepaymentsModule,
    DatabaseModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
