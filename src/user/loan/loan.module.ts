import { Module } from '@nestjs/common';
import { LoanController } from './loan.controller';
import { LoanService } from './loan.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [LoanController],
  exports: [LoanService],
  providers: [LoanService],
  imports: [PrismaModule],
})
export class LoanModule {}
