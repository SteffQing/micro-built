import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { LoanModule } from './loan/loan.module';
import { RepaymentsModule } from './repayments/repayments.module';
import { DatabaseModule } from 'src/database/database.module';
import { PPIService } from './ppi.service';
import { NotificationModule } from 'src/notifications/notifications.module';

// LoanModule and RepaymentsModule are imported for their /user/loan and /user/repayments
// controllers; UserService is exported for the admin customer pages.
@Module({
  imports: [DatabaseModule, NotificationModule, LoanModule, RepaymentsModule],
  controllers: [UserController],
  providers: [UserService, PPIService],
  exports: [UserService],
})
export class UserModule {}
