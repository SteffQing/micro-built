import { Module } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { RepaymentsController } from './repayments.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  controllers: [RepaymentsController],
  providers: [RepaymentsService],
  exports: [RepaymentsService],
  imports: [DatabaseModule],
})
export class RepaymentsModule {}
