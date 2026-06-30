import { Module } from '@nestjs/common';
import { QueueModule } from 'src/queue/bull/queue.module';
import { ExportService } from './exports.service';
import { AdminExportsController } from './exports.controller';
import { UserExportsController } from './user-exports.controller';

@Module({
  imports: [QueueModule],
  controllers: [AdminExportsController, UserExportsController],
  providers: [ExportService],
})
export class ExportsModule {}
