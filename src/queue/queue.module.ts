import { Module } from '@nestjs/common';
import { QueueProducer } from './queue.producer';
import { BullModule } from '@nestjs/bull';
import { RepaymentsConsumer, GenerateReports } from './queue.consumer';
import { QueueName } from 'src/common/types';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/database/database.module';
import { NotificationModule } from 'src/notifications/notifications.module';

@Module({
  providers: [QueueProducer, RepaymentsConsumer, GenerateReports],
  imports: [
    BullModule.registerQueue(
      {
        name: QueueName.repayments,
      },
      { name: QueueName.reports },
    ),
    DatabaseModule,
    ConfigModule,
    NotificationModule,
  ],
  exports: [QueueProducer],
})
export class QueueModule {}
