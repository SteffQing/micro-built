import { AuditModule } from 'src/audit/audit.module';
import { Module } from '@nestjs/common';
import { LiquidationsModule } from 'src/liquidations/liquidations.module';
import { StatementsModule } from 'src/statements/statements.module';
import { DocumentsModule } from 'src/documents/documents.module';
import { AuthModule } from 'src/auth/auth.module';
import { ChangeRequestsModule } from 'src/change-requests/change-requests.module';
import { CommoditiesModule } from 'src/commodities/commodities.module';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { QueueModule } from 'src/queue/bull/queue.module';
import { SettingsModule } from 'src/settings/settings.module';
import { CustomerController } from './customer.controller';
import { CustomerDetailsService } from './customer-details.service';
import { CustomerService } from './customer.service';
import { AccountOfficerController, CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { OwnCustomerGuard } from './own-customer.guard';

@Module({
  imports: [
    LiquidationsModule,
    StatementsModule,
    DocumentsModule,
    AuditModule,
    AuthModule,
    ChangeRequestsModule,
    CommoditiesModule,
    DatabaseModule,
    LedgerModule,
    NotificationModule,
    QueueModule,
    SettingsModule,
  ],
  controllers: [CustomersController, AccountOfficerController, CustomerController],
  providers: [CustomersService, CustomerService, CustomerDetailsService, OwnCustomerGuard],
  exports: [CustomersService],
})
export class CustomersModule {}
