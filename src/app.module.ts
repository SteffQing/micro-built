import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { ConfigModule } from './config/config.module';
import { BullModule } from '@nestjs/bull';
import { QueueModule } from './queue/queue.module';
import { DatabaseModule } from './database/database.module';
import Redis from 'ioredis';

function createRedisClient() {
  return new Redis({
    host: process.env.RENDER_REDIS_TCP,
    port: 6379,
    username: process.env.RENDER_REDIS_USERNAME,
    password: process.env.RENDER_REDIS_TOKEN,
    tls: {},
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
  });
}

@Module({
  imports: [
    BullModule.forRoot({
      createClient: (type) => {
        return createRedisClient();
      },
    }),
    AuthModule,
    NotificationModule,
    AdminModule,
    UserModule,
    ConfigModule,
    BullModule,
    QueueModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
