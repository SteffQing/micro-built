import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { QueueName } from 'src/common/types';
import { MaintenanceQueueName } from 'src/common/types/queue.interface';
import { SupabaseService } from 'src/database/supabase.service';

@Processor(QueueName.maintenance)
export class MaintenanceService {
  constructor(private readonly supabase: SupabaseService) {}

  @Process(MaintenanceQueueName.supabase_ping)
  async handleSupabasePing(job: Job) {
    const res = await this.supabase.ping();

    return { ...res, time: new Date().toISOString() };
  }
}
