import { Module } from '@nestjs/common';
import { QueueProducer } from './queue.producer';
import { BullModule } from '@nestjs/bull';
import { GenerateReports } from './queue.reports';
import { QueueName } from 'src/common/types';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/database/database.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { RepaymentsConsumer } from './queue.repayments';
import { ServicesConsumer } from './queue.service';

@Module({
  providers: [
    QueueProducer,
    RepaymentsConsumer,
    GenerateReports,
    ServicesConsumer,
  ],
  imports: [
    BullModule.registerQueue(
      {
        name: QueueName.repayments,
      },
      { name: QueueName.reports },
      { name: QueueName.services },
    ),
    DatabaseModule,
    ConfigModule,
    NotificationModule,
  ],
  exports: [QueueProducer],
})
export class QueueModule {}
