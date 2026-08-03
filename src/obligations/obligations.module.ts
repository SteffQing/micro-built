import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { RepaymentObligationService } from './repayment-obligation.service';
import { RepaymentObligationController } from './repayment-obligation.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [RepaymentObligationController],
  providers: [RepaymentObligationService],
  exports: [RepaymentObligationService],
})
export class ObligationsModule {}
