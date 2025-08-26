import { Module } from '@nestjs/common';
import { QueueProducer } from './queue.producer';
import { BullModule } from '@nestjs/bull';
import { RepaymentsConsumer, GenerateReportConsumer } from './queue.consumer';
import { QueueName } from 'src/common/types';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  providers: [QueueProducer, RepaymentsConsumer, GenerateReportConsumer],
  imports: [
    BullModule.registerQueue(
      {
        name: QueueName.repayments,
      },
      { name: QueueName.reports },
    ),
    DatabaseModule,
    ConfigModule,
  ],
  exports: [QueueProducer],
})
export class QueueModule {}
