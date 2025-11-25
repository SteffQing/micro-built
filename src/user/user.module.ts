import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { LoanModule } from './loan/loan.module';
import { RepaymentsModule } from './repayments/repayments.module';
import { DatabaseModule } from 'src/database/database.module';
import { PPIService } from './ppi.service';

@Module({
  imports: [DatabaseModule, LoanModule, RepaymentsModule],
  controllers: [UserController],
  providers: [UserService, PPIService],
  exports: [UserService],
})
export class UserModule {}
