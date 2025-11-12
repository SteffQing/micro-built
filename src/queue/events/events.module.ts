import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthService } from './events.service';
import { NotificationModule } from 'src/notifications/notifications.module';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [EventEmitterModule.forRoot(), NotificationModule, DatabaseModule],
  providers: [AuthService],
})
export class EventsModule {}
