import { Module } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { RepaymentsController } from './repayments.controller';
import { ConfigModule } from 'src/config/config.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  controllers: [RepaymentsController],
  providers: [RepaymentsService],
  imports: [ConfigModule, PrismaModule, SupabaseModule, QueueModule],
})
export class RepaymentsModule {}
