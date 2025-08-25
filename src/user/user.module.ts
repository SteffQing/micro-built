import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { LoanModule } from './loan/loan.module';
import { RepaymentsModule } from './repayments/repayments.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule, LoanModule, RepaymentsModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
