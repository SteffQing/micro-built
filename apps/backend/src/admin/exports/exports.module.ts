import { Module } from '@nestjs/common';
import { QueueModule } from 'src/queue/bull/queue.module';
import { AdminExportsController } from './exports.controller';
import { ExportService } from './exports.service';
import { UserExportsController } from './user-exports.controller';

// Exports only queue a job; the reports queue's consumer (DocumentsModule) builds and delivers
// the file.
@Module({
  imports: [QueueModule],
  controllers: [AdminExportsController, UserExportsController],
  providers: [ExportService],
})
export class ExportsModule {}
