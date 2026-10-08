import { Module } from '@nestjs/common';
import { CustomersModule } from 'src/admin/customers/customers.module';
import { LoanModule as AdminLoanModule } from 'src/admin/loan/loan.module';
import { VariationsModule } from 'src/admin/variations/variations.module';
import { AuditModule } from 'src/audit/audit.module';
import { ChangeRequestsModule } from 'src/change-requests/change-requests.module';
import { DatabaseModule } from 'src/database/database.module';
import { LiquidationsModule } from 'src/liquidations/liquidations.module';
import { MarketerModule } from 'src/marketer/marketer.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { LoanModule } from 'src/user/loan/loan.module';
import { RepaymentsModule } from 'src/user/repayments/repayments.module';
import { UserModule } from 'src/user/user.module';
import { SupportChainService } from './chain/chain.service';
import { SupportGuardService } from './guard/guard.service';
import { SupportLimits } from './limits';
import { SupportAdminController } from './support-admin.controller';
import { SupportAdminService } from './support-admin.service';
import { SupportChatService } from './support-chat.service';
import { SupportEventsService } from './support-events.service';
import { SupportHandoffService } from './support-handoff.service';
import { SupportSummaryService } from './support-summary.service';
import { SupportController, SupportStreamGuard } from './support.controller';
import { SupportService } from './support.service';
import { SupportToolsService } from './tools';

// AI chat support (docs/CHAT_SUPPORT.md). The tools read through the services that already scope the data
// (customers', marketers', admins'), so those modules are imported rather than their queries copied. The retention
// sweep lives in SupportSweepModule, which the maintenance queue imports.
@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    NotificationModule,
    UserModule,
    LoanModule,
    RepaymentsModule,
    LiquidationsModule,
    ChangeRequestsModule,
    CustomersModule,
    MarketerModule,
    AdminLoanModule,
    VariationsModule,
  ],
  controllers: [SupportController, SupportAdminController],
  providers: [
    SupportService,
    SupportLimits,
    SupportChainService,
    SupportGuardService,
    SupportToolsService,
    SupportEventsService,
    SupportHandoffService,
    SupportSummaryService,
    SupportChatService,
    SupportAdminService,
    SupportStreamGuard,
  ],
})
export class SupportModule {}
