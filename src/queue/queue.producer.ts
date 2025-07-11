import { Injectable } from '@nestjs/common';
import { CreateTestDto } from './dto/create-test.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QueueName } from 'src/common/types/queue.interface';

@Injectable()
export class QueueProducer {
  constructor(
    @InjectQueue(QueueName.repayments) private repaymentQueue: Queue,
    // @InjectQueue(QueueName.existing_users) private usersQueue: Queue,
  ) {}
  async create(dto: CreateTestDto) {
    await this.repaymentQueue.add(dto, {
      delay: 3000,
    });

    return 'Queue data has been added';
  }
}
