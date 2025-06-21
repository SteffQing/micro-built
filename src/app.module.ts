import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { RedisService } from './redis/redis.service';
import { RedisModule } from './redis/redis.module';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { AdminModule } from './admin/admin.module';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    PrismaModule,
    CustomersModule,
    AuthModule,
    MailModule,
    RedisModule,
    AdminModule,
    UserModule,
  ],
  controllers: [AppController, AdminController, UserController],
  providers: [AppService, RedisService, AdminService, UserService],
})
export class AppModule {}
