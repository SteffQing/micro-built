import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthService, UserService } from './events.service';
import { NotificationModule } from 'src/notifications/notifications.module';
import { DatabaseModule } from 'src/database/database.module';
import { AdminService } from './events.admin';
import { ConfigModule } from 'src/config/config.module';

@Module({
  imports: [EventEmitterModule.forRoot(), NotificationModule, DatabaseModule, ConfigModule],
  providers: [AuthService, UserService, AdminService],
})
export class EventsModule { }
