import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { LiquidationsModule } from 'src/liquidations/liquidations.module';
import { SettingsModule } from 'src/settings/settings.module';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';

@Module({
  imports: [DatabaseModule, LedgerModule, SettingsModule, LiquidationsModule],
  controllers: [LoanController],
  providers: [LoanService],
  exports: [LoanService],
})
export class LoanModule {}
