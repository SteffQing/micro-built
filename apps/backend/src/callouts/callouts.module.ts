import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QueueName } from 'src/common/types';
import { AuditModule } from 'src/audit/audit.module';
import { DatabaseModule } from 'src/database/database.module';
import { CalloutsAdminController, CalloutsController } from './callouts.controller';
import { CalloutsService } from './callouts.service';

@Module({
  imports: [DatabaseModule, AuditModule, BullModule.registerQueue({ name: QueueName.maintenance })],
  controllers: [CalloutsController, CalloutsAdminController],
  providers: [CalloutsService],
  exports: [CalloutsService],
})
export class CalloutsModule {}
