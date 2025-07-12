import { Module } from '@nestjs/common';
import { QueueProducer } from './queue.producer';
import { BullModule } from '@nestjs/bull';
import { RepaymentsConsumer, ExistingUsersConsumer } from './queue.consumer';
import { QueueName } from 'src/common/types';
import { QueueController } from './queue.controller';

@Module({
  providers: [QueueProducer, RepaymentsConsumer, ExistingUsersConsumer],
  imports: [
    BullModule.registerQueue(
      {
        name: QueueName.repayments,
      },
      { name: QueueName.existing_users },
    ),
  ],
  exports: [QueueProducer],
  controllers: [QueueController],
})
export class QueueModule {}
