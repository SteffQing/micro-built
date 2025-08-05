import { Module } from '@nestjs/common';
import { CashLoanService, CommodityLoanService } from './loan.service';
import { CashLoanController, CommodityLoanController } from './loan.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ConfigModule } from 'src/config/config.module';

@Module({
  controllers: [CashLoanController, CommodityLoanController],
  providers: [CashLoanService, CommodityLoanService],
  imports: [PrismaModule, ConfigModule],
  exports: [CashLoanService, CommodityLoanService],
})
export class LoanModule {}
