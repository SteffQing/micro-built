import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { QueueModule } from 'src/queue/bull/queue.module';
import { VariationsController } from './variations.controller';
import { VariationsAdminService } from './variations.service';

// /admin/variations (PLAN_V2 §2): preview, history, generate, draft and the stored files. The generate and draft
// jobs run in the reports queue's consumer (GenerateReports, provided by the DocumentsModule).
@Module({
  imports: [AuthModule, DatabaseModule, LedgerModule, QueueModule],
  controllers: [VariationsController],
  providers: [VariationsAdminService],
  exports: [VariationsAdminService],
})
export class VariationsModule {}
