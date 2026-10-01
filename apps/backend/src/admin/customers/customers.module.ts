import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { CommoditiesModule } from 'src/commodities/commodities.module';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { QueueModule } from 'src/queue/bull/queue.module';
import { SettingsModule } from 'src/settings/settings.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { AccountOfficerController, CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [
    AuthModule,
    CommoditiesModule,
    DatabaseModule,
    LedgerModule,
    NotificationModule,
    QueueModule,
    SettingsModule,
  ],
  controllers: [CustomersController, AccountOfficerController, CustomerController],
  providers: [CustomersService, CustomerService],
  exports: [CustomersService],
})
export class CustomersModule {}
