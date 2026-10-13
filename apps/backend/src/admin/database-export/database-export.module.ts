import { Module } from '@nestjs/common';
import { AuditModule } from 'src/audit/audit.module';
import { DatabaseModule } from 'src/database/database.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { QueueModule } from 'src/queue/bull/queue.module';
import { DatabaseExportController } from './database-export.controller';
import { DatabaseExportRequestService } from './database-export.service';

// Asking for the export; the reports queue's consumer (DocumentsModule) makes and delivers it.
@Module({
  imports: [AuditModule, DatabaseModule, NotificationModule, QueueModule],
  controllers: [DatabaseExportController],
  providers: [DatabaseExportRequestService],
})
export class DatabaseExportModule {}
