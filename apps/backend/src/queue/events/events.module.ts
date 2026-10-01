import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from 'src/database/database.module';
import { NotificationModule } from 'src/notifications/notifications.module';
import { LedgerListeners } from './ledger.listeners';

// The only events are the ledger's (src/ledger/ledger.events.ts), and they only notify people.
// forRoot() provides the global EventEmitter2 that LedgerTx emits them on after each commit.
@Module({
  imports: [EventEmitterModule.forRoot(), NotificationModule, DatabaseModule],
  providers: [LedgerListeners],
})
export class EventsModule {}
