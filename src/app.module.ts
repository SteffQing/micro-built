import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { RedisService } from './redis/redis.service';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [PrismaModule, CustomersModule, AuthModule, MailModule, RedisModule],
  controllers: [AppController],
  providers: [AppService, RedisService],
})
export class AppModule {}
