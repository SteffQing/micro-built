import { Module } from '@nestjs/common';
import { ChangeRequestsModule } from 'src/change-requests/change-requests.module';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

// /admin/organizations (PLAN_V2 §2): list, merge, switch requests.
@Module({
  imports: [DatabaseModule, LedgerModule, NotificationModule, ChangeRequestsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
