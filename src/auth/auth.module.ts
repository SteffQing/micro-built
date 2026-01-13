import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { MaintenanceGuard } from './maintenance.guard';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/database/database.module';
import { BullBoardMiddleware } from './bullboard.middleware';

@Module({
  imports: [
    DatabaseModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { useClass: MaintenanceGuard, provide: APP_GUARD },
    BullBoardMiddleware,
  ],
  exports: [BullBoardMiddleware],
})
export class AuthModule {}
