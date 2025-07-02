import { Body, Controller, Post } from '@nestjs/common';
import { QueueProducer } from './queue.producer';
import { CreateTestDto } from './dto/create-test.dto';

@Controller('queue')
export class QueueController {
  constructor(private readonly queue: QueueProducer) {}

  @Post()
  async createTestQueue(@Body() dto: CreateTestDto) {
    await this.queue.create(dto);
    return 'Queue initiated';
  }
}
