import { Module } from '@nestjs/common';
import { MaintenanceProducer, QueueProducer } from './queue.producer';
import { BullModule } from '@nestjs/bull';
import { GenerateReports } from './queue.reports';
import { QueueName } from 'src/common/types';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/database/database.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { RepaymentsConsumer } from './queue.repayments';
import { ServicesConsumer } from './queue.service';
import { MaintenanceService } from './queue.maintenance';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { BullBoardMiddleware } from 'src/auth/bullboard.middleware';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  providers: [
    QueueProducer,
    MaintenanceProducer,
    RepaymentsConsumer,
    GenerateReports,
    ServicesConsumer,
    MaintenanceService,
  ],
  imports: [
    AuthModule,
    BullModule.registerQueue(
      {
        name: QueueName.repayments,
      },
      { name: QueueName.reports },
      { name: QueueName.services },
      { name: QueueName.maintenance },
    ),
    BullBoardModule.forFeature(
      {
        name: QueueName.repayments,
        adapter: BullAdapter,
      },
      { name: QueueName.reports, adapter: BullAdapter },
      { name: QueueName.services, adapter: BullAdapter },
      { name: QueueName.maintenance, adapter: BullAdapter },
    ),
    DatabaseModule,
    ConfigModule,
    NotificationModule,
  ],
  exports: [QueueProducer],
})
export class QueueModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(BullBoardMiddleware).forRoutes('/queues');
  }
}
