import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { SettingsModule } from 'src/settings/settings.module';
import { DeductionsService } from './deductions.service';
import { LedgerClock } from './ledger.clock';
import { LedgerService } from './ledger.service';
import { LedgerTx } from './ledger.tx';
import { LiquidationsService } from './liquidations.service';
import { VariationLockService } from './variation-lock.service';
import { PeriodsService } from './periods.service';
import { StatementService } from './statement.service';
import { TenureChangesService } from './tenure-changes.service';
import { VariationService } from './variation.service';

// The money engine. Dependencies only point down this list, so there are no cycles:
// periods → deductions → tenure changes → ledger → liquidations / variation lock; variations and
// statements read alongside. EventEmitter2 comes from EventEmitterModule.forRoot() (global).
const services = [
  LedgerClock,
  LedgerTx,
  PeriodsService,
  DeductionsService,
  TenureChangesService,
  LedgerService,
  LiquidationsService,
  VariationLockService,
  VariationService,
  StatementService,
];

@Module({
  imports: [DatabaseModule, SettingsModule],
  providers: services,
  exports: services,
})
export class LedgerModule {}
