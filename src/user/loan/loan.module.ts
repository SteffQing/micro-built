import { Module } from '@nestjs/common';
import { LoanController } from './loan.controller';

@Module({
  controllers: [LoanController]
})
export class LoanModule {}
