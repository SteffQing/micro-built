import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { SettingsModule } from 'src/settings/settings.module';
import { CustomerTenureChangesController, TenureChangesController } from './tenure-changes.controller';
import { TenureChangesAdminService } from './tenure-changes.service';

@Module({
  imports: [DatabaseModule, LedgerModule, SettingsModule],
  controllers: [TenureChangesController, CustomerTenureChangesController],
  providers: [TenureChangesAdminService],
})
export class TenureChangesModule {}
