import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from './identity/identity.module';
import { LoanModule } from './loan/loan.module';

@Module({
  imports: [PrismaModule, IdentityModule, LoanModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
