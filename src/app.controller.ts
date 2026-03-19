import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { QueueProducer } from './queue/bull/queue.producer';

@Controller()
export class AppController {
  constructor(
    private readonly app: AppService,
    private readonly task: QueueProducer,
  ) {}

  @Get()
  getHello(): string {
    return this.app.getHello();
  }

  @Get('task')
  async task_producer() {
    const tasks = await this.task.viewTasks();
    return tasks;
  }
}
