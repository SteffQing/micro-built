import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { RedisService } from './redis/redis.service';
import { RedisModule } from './redis/redis.module';
import { AdminModule } from './admin/admin.module';
import { UserModule } from './user/user.module';
import { SupabaseModule } from './supabase/supabase.module';
import { ConfigModule } from './config/config.module';
import { BullModule } from '@nestjs/bull';
import { QueueModule } from './queue/queue.module';
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
      // redis: {
      //   host: 'localhost',
      //   port: 6379,
      // },
      createClient: (type) => {
        return createRedisClient();
      },
    }),
    PrismaModule,
    AuthModule,
    MailModule,
    RedisModule,
    SupabaseModule,
    AdminModule,
    UserModule,
    ConfigModule,
    BullModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [AppService, RedisService],
})
export class AppModule {}
