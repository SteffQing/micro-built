import { Module } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { RepaymentsController } from './repayments.controller';
import { ConfigModule } from 'src/config/config.module';
import { QueueModule } from 'src/queue/queue.module';
import { DatabaseModule } from 'src/database/database.module';
import { NotificationModule } from 'src/notifications/notifications.module';

@Module({
  controllers: [RepaymentsController],
  providers: [RepaymentsService],
  imports: [ConfigModule, DatabaseModule, QueueModule, NotificationModule],
  exports: [RepaymentsService],
})
export class RepaymentsModule {}
