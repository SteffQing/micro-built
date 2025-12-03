import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthService, UserService, CustomerService } from './events.service';
import { NotificationModule } from 'src/notifications/notifications.module';
import { DatabaseModule } from 'src/database/database.module';
import { AdminService } from './events.admin';
import { ConfigModule } from 'src/config/config.module';
import { LoanModule as UserLoanModule } from 'src/user/loan/loan.module';
import { LoanModule as AdminLoanModule } from 'src/admin/loan/loan.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    NotificationModule,
    DatabaseModule,
    ConfigModule,
    UserLoanModule,
    AdminLoanModule,
  ],
  providers: [AuthService, UserService, AdminService, CustomerService],
})
export class EventsModule {}
