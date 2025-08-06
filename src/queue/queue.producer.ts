import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from 'src/common/types';
import { RepaymentQueueName } from 'src/common/types/queue.interface';

@Injectable()
export class QueueProducer {
  constructor(
    @InjectQueue(QueueName.repayments) private repaymentQueue: Queue,
    // @InjectQueue(QueueName.existing_users) private usersQueue: Queue,
  ) {}
  async queueRepayments(docUrl: string) {
    const { id } = await this.repaymentQueue.add(
      RepaymentQueueName.process_new_repayments,
      { url: docUrl },
    );
    return { data: id, message: 'Repayment has been queued for processing' };
  }
}
