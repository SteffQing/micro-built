import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import Redis from 'ioredis';
import { redisOptions, redisUrl } from 'src/common/config/redis.config';
import { DatabaseModule } from 'src/database/database.module';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/notifications/mail.service';
import { NotificationModule } from 'src/notifications/notifications.module';
import { SmsService } from 'src/notifications/sms.service';
import { SettingsModule } from 'src/settings/settings.module';
import { AccessGuard } from './access.guard';
import { AuthAccountsService } from './auth-accounts.service';
import { createAuth } from './auth.config';
import { deliverySenders, readAuthEnv, runtimeAuthDeps } from './auth.runtime';
import { BullBoardMiddleware } from './bullboard.middleware';
import { MaintenanceGuard } from './maintenance.guard';
import { ConfirmationGuard } from './confirmation.guard';
import { ConfirmationsController } from './confirmations.controller';
import { ConfirmationsService, PASSKEY_RP } from './confirmations.service';
import { ChangeRequestsModule } from 'src/change-requests/change-requests.module';
import { ChangeRequestsService } from 'src/change-requests/change-requests.service';

@Module({
  imports: [
    // better-auth serves /api/auth/* (D1). Its own global guard and CORS are off: AccessGuard is the
    // single guard (every route private unless @AllowAnonymous), and main.ts owns CORS.
    BetterAuthModule.forRootAsync({
      imports: [DatabaseModule, NotificationModule, ChangeRequestsModule],
      inject: [PrismaService, MailService, SmsService, ChangeRequestsService],
      useFactory: (prisma: PrismaService, mail: MailService, sms: SmsService, changes: ChangeRequestsService) => ({
        auth: createAuth({
          ...runtimeAuthDeps(
            prisma,
            deliverySenders(mail, sms),
            readAuthEnv(),
            // Its own client: RedisService connects in onModuleInit, after this factory runs.
            // Fail fast rather than queue forever when Redis is down.
            new Redis(redisUrl, { ...redisOptions, maxRetriesPerRequest: 3 }),
          ),
          holdProfileChange: (userId, fields) => changes.holdProfileChange(userId, fields),
        }),
        disableTrustedOriginsCors: true,
        bodyParser: { json: { limit: '2mb' }, urlencoded: { limit: '2mb', extended: true } },
      }),
      disableGlobalAuthGuard: true,
    }),
    DatabaseModule,
    SettingsModule,
  ],
  controllers: [ConfirmationsController],
  providers: [
    AuthAccountsService,
    ConfirmationsService,
    { provide: PASSKEY_RP, useFactory: () => readAuthEnv().passkey },
    BullBoardMiddleware,
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
    // After AccessGuard, which puts the user and session on the request.
    { provide: APP_GUARD, useClass: ConfirmationGuard },
  ],
  exports: [AuthAccountsService, ConfirmationsService, BullBoardMiddleware],
})
export class AuthModule {}
