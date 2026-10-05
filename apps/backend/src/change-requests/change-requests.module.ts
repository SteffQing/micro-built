import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { AdminChangeRequestsController, UserChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';

// Exported for PPIService (identity, payment method), the avatar upload and better-auth's
// user-update hook (auth.module.ts), which all submit changes here instead of writing them.
@Module({
  imports: [DatabaseModule, LedgerModule, NotificationModule],
  controllers: [UserChangeRequestsController, AdminChangeRequestsController],
  providers: [ChangeRequestsService],
  exports: [ChangeRequestsService],
})
export class ChangeRequestsModule {}
