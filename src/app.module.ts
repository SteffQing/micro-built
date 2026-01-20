import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { ConfigModule } from './config/config.module';
import { BullModule } from '@nestjs/bull';
import { QueueModule } from './queue/bull/queue.module';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './queue/events/events.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { redisOptions, redisUrl } from './common/config/redis.config';
import Redis from 'ioredis';

@Module({
  imports: [
    BullModule.forRoot({
      createClient: () => new Redis(redisUrl, redisOptions),
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
    ConfigModule,
    AdminModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
