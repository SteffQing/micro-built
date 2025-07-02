import { Module } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { RepaymentsController } from './repayments.controller';
import { ConfigModule } from 'src/config/config.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  controllers: [RepaymentsController],
  providers: [RepaymentsService],
  imports: [ConfigModule, PrismaModule],
})
export class RepaymentsModule {}
