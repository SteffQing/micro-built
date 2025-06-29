import { Module } from '@nestjs/common';
import { CustomerService, CustomersService } from './customers.service';
import {
  CustomerController,
  CustomersController,
} from './customers.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RepaymentsModule } from 'src/user/repayments/repayments.module';

@Module({
  controllers: [CustomersController, CustomerController],
  providers: [CustomersService, CustomerService],
  imports: [PrismaModule, RepaymentsModule],
  exports: [CustomersService],
})
export class CustomersModule {}
