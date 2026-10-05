import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

// Depends on nothing but the database, so any module can record to it (SettingsModule sits
// below the ledger and can't use LedgerTx.audit).
@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
