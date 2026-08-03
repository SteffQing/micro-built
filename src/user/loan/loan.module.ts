import { Module } from '@nestjs/common';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/database/database.module';
import { ObligationsModule } from 'src/obligations/obligations.module';

@Module({
  controllers: [LoanController],
  exports: [LoanService],
  providers: [LoanService],
  imports: [DatabaseModule, ConfigModule, ObligationsModule],
})
export class LoanModule {}
