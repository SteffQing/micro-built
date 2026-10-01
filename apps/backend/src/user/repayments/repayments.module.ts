import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';

@Module({
  imports: [DatabaseModule],
  controllers: [RepaymentsController],
  providers: [RepaymentsService],
  exports: [RepaymentsService],
})
export class RepaymentsModule {}
