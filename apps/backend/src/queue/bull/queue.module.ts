import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { QueueName } from 'src/common/types';
import { AuthModule } from 'src/auth/auth.module';
import { BullBoardMiddleware } from 'src/auth/bullboard.middleware';
import { CommoditiesModule } from 'src/commodities/commodities.module';
import { DatabaseModule } from 'src/database/database.module';
import { LedgerModule } from 'src/ledger/ledger.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { SettingsModule } from 'src/settings/settings.module';
import { MaintenanceProducer, QueueProducer } from './queue.producer';
import { ServicesConsumer } from './queue.service';
import { MaintenanceService } from './queue.maintenance';

// The four queues, their producers and Bull Board. A consumer lives with the code it runs, so
// modules that enqueue jobs can import this one without a cycle: RepaymentsConsumer is provided
// by the admin RepaymentsModule and GenerateReports by the DocumentsModule (Bull finds a
// @Processor in any module).
@Module({
  providers: [QueueProducer, MaintenanceProducer, ServicesConsumer, MaintenanceService],
  imports: [
    AuthModule,
    BullModule.registerQueue(
      { name: QueueName.repayments },
      { name: QueueName.reports },
      { name: QueueName.services },
      { name: QueueName.maintenance },
    ),
    BullBoardModule.forFeature(
      { name: QueueName.repayments, adapter: BullAdapter },
      { name: QueueName.reports, adapter: BullAdapter },
      { name: QueueName.services, adapter: BullAdapter },
      { name: QueueName.maintenance, adapter: BullAdapter },
    ),
    DatabaseModule,
    LedgerModule,
    SettingsModule,
    CommoditiesModule,
    NotificationModule,
  ],
  exports: [QueueProducer],
})
export class QueueModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(BullBoardMiddleware).forRoutes('/queues');
  }
}
