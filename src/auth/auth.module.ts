import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from './jwt.strategy';
import { NotificationModule } from '../notifications/notifications.module';
import { RedisModule } from '../redis/redis.module';
import { MaintenanceGuard } from './maintenance.guard';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from 'src/config/config.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    NotificationModule,
    RedisModule,
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { useClass: MaintenanceGuard, provide: APP_GUARD },
  ],
})
export class AuthModule {}
