import { Module } from '@nestjs/common';
import { CustomerService, CustomersService } from './customers.service';
import {
  CustomerController,
  CustomersController,
} from './customers.controller';
import { RepaymentsModule as UserRepaymentModule } from 'src/user/repayments/repayments.module';
import { RepaymentsModule as AdminRepaymentModule } from '../repayments/repayments.module';
import { UserModule } from 'src/user/user.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/database/database.module';
import { QueueModule } from 'src/queue/bull/queue.module';

@Module({
  controllers: [CustomersController, CustomerController],
  providers: [CustomersService, CustomerService],
  imports: [
    UserRepaymentModule,
    AdminRepaymentModule,
    DatabaseModule,
    UserModule,
    NotificationModule,
    ConfigModule,
    QueueModule,
  ],
  exports: [CustomersService],
})
export class CustomersModule {}
