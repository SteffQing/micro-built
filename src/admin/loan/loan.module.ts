import { Module } from '@nestjs/common';
import { CashLoanService, CommodityLoanService } from './loan.service';
import { CashLoanController, CommodityLoanController } from './loan.controller';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [CashLoanController, CommodityLoanController],
  providers: [CashLoanService, CommodityLoanService],
  imports: [DatabaseModule, ConfigModule],
  exports: [CashLoanService, CommodityLoanService],
})
export class LoanModule {}
