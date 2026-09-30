import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Access, AllowAnonymous } from './auth/decorators';
import { QueueProducer } from './queue/bull/queue.producer';

@Controller()
export class AppController {
  constructor(
    private readonly app: AppService,
    private readonly task: QueueProducer,
  ) {}

  @AllowAnonymous()
  @Get()
  getHello(): string {
    return this.app.getHello();
  }

  // Queue internals: super admins only (v1 left it open).
  @Access('SUPER_ADMIN')
  @Get('task')
  async task_producer() {
    const tasks = await this.task.viewTasks();
    return tasks;
  }
}
