import { BullModule, InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, Module } from '@nestjs/common';
import type { Queue } from 'bull';
import { captureJobError } from 'src/common/observability';
import { MaintenanceQueueName, QueueName } from 'src/common/types/queue.interface';
import { DatabaseModule } from 'src/database/database.module';
import { PrismaService } from 'src/database/prisma.service';
import { InappService } from 'src/notifications/inapp.service';
import { NotificationModule } from 'src/notifications/notifications.module';
import { SupportChainService } from './chain/chain.service';
import { supportSubject } from './paths';
import { SupportEventsService } from './support-events.service';
import { SupportSummaryService } from './support-summary.service';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A conversation with no new message for this long is closed. */
export const IDLE_CLOSE_HOURS = 24;
/** A closed conversation is deleted this long after it closed. */
export const RETENTION_DAYS = 7;
export const AUTO_CLOSED = `Closed after ${IDLE_CLOSE_HOURS} hours without a new message`;
/** What the daily catch-up handles in one run; the next day takes the rest. */
const CATCH_UP_BATCH = 200;

/**
 * A support conversation's life (CHAT_SUPPORT.md C9) as delayed jobs on the maintenance queue, like a callout's expiry:
 *
 * - **Closing.** Starting a conversation queues a check for 24 hours later. When it runs, a conversation with a message
 *   in the last 24 hours queues the next check for 24 hours after that message; one without is closed as staff closing
 *   it would be (a line in the thread, the live status event, and for one the team handled, the admins' prompt cleared
 *   and the closing summary emailed). One nobody wrote in is deleted.
 * - **Deleting.** However it closed (staff, the requester or the check), it is deleted 7 days later; its messages cascade.
 *
 * A daily run catches any conversation whose job Redis lost. Its own module, so the maintenance queue runs it without
 * the whole support module.
 */
@Injectable()
export class SupportSweepService {
  private readonly logger = new Logger(SupportSweepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inapp: InappService,
    private readonly events: SupportEventsService,
    private readonly summary: SupportSummaryService,
    @InjectQueue(QueueName.maintenance) private readonly queue: Queue,
  ) {}

  /** Queues the idle check for 24 hours after `from`: the conversation's start, or its last message. */
  scheduleClose(conversationId: string, from = new Date()) {
    return this.schedule(MaintenanceQueueName.support_close, conversationId, from.getTime() + IDLE_CLOSE_HOURS * HOUR_MS);
  }

  /** Queues the deletion for 7 days after `closedAt`. */
  scheduleDelete(conversationId: string, closedAt = new Date()) {
    return this.schedule(MaintenanceQueueName.support_delete, conversationId, closedAt.getTime() + RETENTION_DAYS * DAY_MS);
  }

  /** The idle check: closes it, or (written in within the last 24 hours) queues the next check. */
  async closeIfIdle(conversationId: string, now = new Date()): Promise<'closed' | 'extended' | 'deleted' | 'gone'> {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id: conversationId },
      select: { status: true, lastMessageAt: true, handedOffAt: true, _count: { select: { messages: true } } },
    });
    if (!conversation || conversation.status === 'CLOSED') return 'gone';
    if (conversation._count.messages === 0) {
      await this.prisma.supportConversation.deleteMany({ where: { id: conversationId, messages: { none: {} } } });
      return 'deleted';
    }
    if (conversation.lastMessageAt.getTime() + IDLE_CLOSE_HOURS * HOUR_MS > now.getTime()) {
      await this.scheduleClose(conversationId, conversation.lastMessageAt);
      return 'extended';
    }
    return (await this.close(conversationId, conversation.handedOffAt !== null, now)) ? 'closed' : 'gone';
  }

  /** The deletion: only a conversation closed at least 7 days ago. */
  async deleteIfDue(conversationId: string, now = new Date()): Promise<boolean> {
    const { count } = await this.prisma.supportConversation.deleteMany({
      where: { id: conversationId, status: 'CLOSED', closedAt: { lte: new Date(now.getTime() - RETENTION_DAYS * DAY_MS) } },
    });
    return count > 0;
  }

  /** Daily: whatever a lost job left, closed or deleted now. */
  async catchUp(now = new Date()) {
    const idleBefore = new Date(now.getTime() - IDLE_CLOSE_HOURS * HOUR_MS);
    const idle = await this.prisma.supportConversation.findMany({
      where: { status: { not: 'CLOSED' }, lastMessageAt: { lt: idleBefore } },
      orderBy: { lastMessageAt: 'asc' },
      take: CATCH_UP_BATCH,
      select: { id: true },
    });
    let closed = 0;
    for (const { id } of idle) {
      try {
        if ((await this.closeIfIdle(id, now)) !== 'extended') closed++;
      } catch (error) {
        this.logger.error(`Closing idle support conversation ${id} failed: ${(error as Error).message}`);
      }
    }
    const { count: deleted } = await this.prisma.supportConversation.deleteMany({
      where: { status: 'CLOSED', closedAt: { lt: new Date(now.getTime() - RETENTION_DAYS * DAY_MS) } },
    });
    return { closed, deleted };
  }

  private async close(id: string, handedOff: boolean, now: Date): Promise<boolean> {
    const idleBefore = new Date(now.getTime() - IDLE_CLOSE_HOURS * HOUR_MS);
    const done = await this.prisma.$transaction(async (tx) => {
      // Checked again: a message or a close since the read wins.
      const { count } = await tx.supportConversation.updateMany({
        where: { id, status: { not: 'CLOSED' }, lastMessageAt: { lt: idleBefore } },
        data: { status: 'CLOSED', closedAt: now, staffUnread: false },
      });
      if (count === 0) return false;
      await tx.supportMessage.create({ data: { conversationId: id, role: 'SYSTEM', body: AUTO_CLOSED, createdAt: now } });
      return true;
    });
    if (!done) return false;
    await this.scheduleDelete(id, now);
    await this.events.publish(id, 'status', { status: 'CLOSED' });
    if (handedOff) {
      await this.inapp.removeBySubject(supportSubject(id));
      // Only a conversation the team handled is summarised by email: an assistant-only chat closing isn't news.
      await this.summary.sendFor(id);
    }
    return true;
  }

  /** Without Redis it's reported, not thrown: the daily catch-up handles the conversation. */
  private async schedule(name: MaintenanceQueueName, conversationId: string, at: number) {
    try {
      await this.queue.add(
        name,
        { conversationId },
        {
          delay: Math.max(0, at - Date.now()),
          jobId: `${name}:${conversationId}:${at}`,
          removeOnComplete: true,
          removeOnFail: 50,
        },
      );
    } catch (error) {
      this.logger.error(`Queuing ${name} for ${conversationId} failed`, error instanceof Error ? error.stack : String(error));
      captureJobError(error, { queue: QueueName.maintenance, job: name });
    }
  }
}

/**
 * The lifecycle with what closing needs. The live events, the model chain and the closing summary live here, exported,
 * so the support module and the maintenance queue share one of each.
 */
@Module({
  imports: [DatabaseModule, NotificationModule, BullModule.registerQueue({ name: QueueName.maintenance })],
  providers: [SupportSweepService, SupportEventsService, SupportChainService, SupportSummaryService],
  exports: [SupportSweepService, SupportEventsService, SupportChainService, SupportSummaryService],
})
export class SupportSweepModule {}
