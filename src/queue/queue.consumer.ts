import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { CreateTestDto } from './dto/create-test.dto';
import { QueueName } from 'src/common/types';

@Processor(QueueName.repayments)
export class RepaymentsConsumer {
  @Process()
  async handleTask(job: Job<CreateTestDto>) {
    const { message, count } = job.data;
    let progress = 0;

    for (let i = 0; i < count; i++) {
      await this.sendEmail(message, i);

      progress++;

      await job.progress(progress);
    }
  }

  async sendEmail(message: string, i: number) {
    const res = await fetch('https://push.tg/r66373f', {
      method: 'POST',
      body: message,
      headers: { 'Content-Type': 'text/plain' },
    }).then((res) => res.json());

    console.log(`Completed Task ${i + 1}: ${JSON.stringify(res, null, 2)}`);
    const delay = (i + 1) * i;

    return new Promise((resolve, _) => {
      setTimeout(() => {
        resolve(message);
      }, 3000 * delay);
    });
  }
}

@Processor(QueueName.existing_users)
export class ExistingUsersConsumer {
  @Process()
  async handleTask(job: Job<CreateTestDto>) {
    const { message, count } = job.data;
    let progress = 0;

    for (let i = 0; i < count; i++) {
      await this.sendEmail(message, i);

      progress++;

      await job.progress(progress);
    }
  }

  async sendEmail(message: string, i: number) {
    const res = await fetch('https://push.tg/r66373f', {
      method: 'POST',
      body: message,
      headers: { 'Content-Type': 'text/plain' },
    }).then((res) => res.json());

    console.log(`Completed Task ${i + 1}: ${JSON.stringify(res, null, 2)}`);
    const delay = (i + 1) * i;

    return new Promise((resolve, _) => {
      setTimeout(() => {
        resolve(message);
      }, 3000 * delay);
    });
  }
}
