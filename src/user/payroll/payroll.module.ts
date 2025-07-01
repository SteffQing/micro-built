import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [PayrollController],
  providers: [PayrollService],
  imports: [PrismaModule],
  exports: [PayrollService],
})
export class PayrollModule {}
