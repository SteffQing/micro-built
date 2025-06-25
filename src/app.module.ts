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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    MailModule,
    RedisModule,
    SupabaseModule,
    AdminModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService, RedisService],
})
export class AppModule {}
