import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventsService } from './events.service';
import { NotificationModule } from 'src/notifications/notifications.module';

@Module({
  imports: [EventEmitterModule.forRoot(), NotificationModule],
  providers: [EventsService],
})
export class EventsModule {}
