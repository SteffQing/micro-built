import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LoanService } from './loan/loan.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [UserService, LoanService],
})
export class UserModule {}
