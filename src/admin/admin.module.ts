import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from 'src/mail/mail.module';
import { ConfigModule } from 'src/config/config.module';
import { LoanModule } from './loan/loan.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CustomersModule } from './customers/customers.module';
import { RepaymentsModule } from './repayments/repayments.module';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    ConfigModule,
    LoanModule,
    DashboardModule,
    CustomersModule,
    RepaymentsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
