import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from './identity/identity.module';
import { LoanModule } from './loan/loan.module';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { PaymentMethodModule } from './payment-method/payment-method.module';
import { RepaymentsModule } from './repayments/repayments.module';
import { PayrollModule } from './payroll/payroll.module';

@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    LoanModule,
    SupabaseModule,
    PaymentMethodModule,
    RepaymentsModule,
    PayrollModule,
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
