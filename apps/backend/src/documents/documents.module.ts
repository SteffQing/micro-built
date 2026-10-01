import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { GenerateReports } from 'src/queue/bull/queue.reports';
import { DocumentsService } from './documents.service';

// Generated files (D11). The reports queue's consumer lives here, with the code it runs; the
// queue itself is registered by QueueModule (Bull finds a @Processor in any module).
@Module({
  imports: [DatabaseModule, NotificationModule, LedgerModule],
  providers: [DocumentsService, GenerateReports],
  exports: [DocumentsService],
})
export class DocumentsModule {}
