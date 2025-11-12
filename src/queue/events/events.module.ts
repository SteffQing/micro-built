import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthService, UserService } from './events.service';
import { NotificationModule } from 'src/notifications/notifications.module';
import { DatabaseModule } from 'src/database/database.module';
import { AdminService } from './events.admin';

@Module({
  imports: [EventEmitterModule.forRoot(), NotificationModule, DatabaseModule],
  providers: [AuthService, UserService, AdminService],
})
export class EventsModule {}
