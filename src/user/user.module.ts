import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LoanModule } from './loan/loan.module';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { RepaymentsModule } from './repayments/repayments.module';

@Module({
  imports: [PrismaModule, LoanModule, SupabaseModule, RepaymentsModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
