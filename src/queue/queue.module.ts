import { Module } from '@nestjs/common';
import { QueueProvider } from './queue.producer';
import { BullModule } from '@nestjs/bull';
import { RepaymentsConsumer, ExistingUsersConsumer } from './queue.consumer';
import { QueueName } from 'src/common/types/queue.interface';

@Module({
  providers: [QueueProvider, RepaymentsConsumer, ExistingUsersConsumer],
  imports: [
    BullModule.registerQueue(
      {
        name: QueueName.repayments,
      },
      { name: QueueName.existing_users },
    ),
  ],
})
export class QueueModule {}
