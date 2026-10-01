import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { LiquidationRequestsService } from './liquidation-requests.service';

// Liquidation requests with proof, shared by the customer's routes (/user/…) and the admin's
// (/admin/customer/:id/…); the routes live on those controllers so their paths sit before `:id`.
@Module({
  imports: [DatabaseModule, LedgerModule, NotificationModule],
  providers: [LiquidationRequestsService],
  exports: [LiquidationRequestsService],
})
export class LiquidationsModule {}
