import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { QueueName } from 'src/common/types';
import { MaintenanceQueueName } from 'src/common/types/queue.interface';
import { SupabaseService } from 'src/database/supabase.service';
import { QueueProducer } from './queue.producer';

@Processor(QueueName.maintenance)
export class MaintenanceService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly producer: QueueProducer,
  ) {}

  @Process(MaintenanceQueueName.supabase_ping)
  async handleSupabasePing(_: Job) {
    const res = await this.supabase.ping();

    return { ...res, time: new Date().toISOString() };
  }

  @Process(MaintenanceQueueName.report)
  async handleAutoReport(_: Job) {
    const now = new Date();
    const monthName = now
      .toLocaleString('default', { month: 'long' })
      .toUpperCase();
    const year = now.getFullYear();
    const period = `${monthName} ${year}`;

    const schedule = await this.supabase.getVariationSchedule(period);

    if (schedule) {
      return {
        status: 'skipped',
        message: `Report for ${period} already exists.`,
      };
    }

    await this.producer.generateReport({
      period,
      save: true,
      email: 'steveola23@gmail.com',
    });

    return { status: 'triggered', period };
  }
}
