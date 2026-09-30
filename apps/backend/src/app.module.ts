import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { SettingsModule } from './settings/settings.module';
import { CommoditiesModule } from './commodities/commodities.module';
import { BullModule } from '@nestjs/bull';
import { QueueModule } from './queue/bull/queue.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './queue/events/events.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { redisOptions, redisUrl } from './common/config/redis.config';
import { ExportsModule } from './admin/exports/exports.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    BullModule.forRoot({
      url: redisUrl,
      redis: redisOptions,
    }),
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    DatabaseModule,
    NotificationModule,
    QueueModule,
    EventsModule,
    AuthModule,
    SettingsModule,
    CommoditiesModule,
    AdminModule,
    UserModule,
    ExportsModule,
  ],
  controllers: [AppController],
  providers: [
    // Registered before any other filter: reports what isn't an HttpException (4xx stay out).
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    AppService,
  ],
})
export class AppModule {}
