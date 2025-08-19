import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from 'src/common/types';
import { RepaymentQueueName } from 'src/common/types/queue.interface';
import {
  LiquidationResolution,
  ResolveRepayment,
} from 'src/common/types/repayment.interface';

@Injectable()
export class QueueProducer {
  constructor(
    @InjectQueue(QueueName.repayments) private repaymentQueue: Queue,
    // @InjectQueue(QueueName.existing_users) private usersQueue: Queue,
  ) {}
  async queueRepayments(docUrl: string, period: string) {
    await this.repaymentQueue.add(RepaymentQueueName.process_new_repayments, {
      url: docUrl,
      period,
    });
    return { data: null, message: 'Repayment has been queued for processing' };
  }

  async overflowRepayment(dto: ResolveRepayment) {
    await this.repaymentQueue.add(
      RepaymentQueueName.process_overflow_repayments,
      dto,
    );
  }

  async liquidationRequest(dto: LiquidationResolution) {
    await this.repaymentQueue.add(
      RepaymentQueueName.process_liquidation_request,
      dto,
    );
  }
}
