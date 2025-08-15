import { Module } from '@nestjs/common';
import { CustomerService, CustomersService } from './customers.service';
import {
  CustomerController,
  CustomersController,
} from './customers.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RepaymentsModule } from 'src/user/repayments/repayments.module';
import { LoanModule as UserLoanModule } from 'src/user/loan/loan.module';
import { LoanModule as AdminLoanModule } from '../loan/loan.module';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { UserModule } from 'src/user/user.module';

@Module({
  controllers: [CustomersController, CustomerController],
  providers: [CustomersService, CustomerService],
  imports: [
    PrismaModule,
    RepaymentsModule,
    UserLoanModule,
    AdminLoanModule,
    SupabaseModule,
    UserModule,
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
