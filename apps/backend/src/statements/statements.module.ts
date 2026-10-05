import { AuditModule } from 'src/audit/audit.module';
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { QueueModule } from 'src/queue/bull/queue.module';
import { StatementsService } from './statements.service';
import { UserStatementsController } from './user-statements.controller';

@Module({
  imports: [AuditModule, DatabaseModule, LedgerModule, QueueModule],
  controllers: [UserStatementsController],
  providers: [StatementsService],
  exports: [StatementsService],
})
export class StatementsModule {}
