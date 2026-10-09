import { Injectable, Logger, Module } from '@nestjs/common';
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
/** Every conversation is deleted this long after its last message (closed by then: see IDLE_CLOSE_HOURS). */
export const RETENTION_DAYS = 7;
export const AUTO_CLOSED = `Closed after ${IDLE_CLOSE_HOURS} hours without a new message`;
/** Conversations closed per run; the next hour takes the rest. */
const CLOSE_BATCH = 200;

/**
 * The hourly support sweep (CHAT_SUPPORT.md C9, §1.8). It closes conversations left for a day without a new message,
 * as staff closing them would (a line in the thread, the admins' prompt cleared, the live status event, and for one the
 * team handled, the closing summary by email), then deletes every conversation a week after its last message; their
 * messages cascade. Its own module, so the maintenance queue runs it without the whole support module.
 */
@Injectable()
export class SupportSweepService {
  private readonly logger = new Logger(SupportSweepService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inapp: InappService,
    private readonly events: SupportEventsService,
    private readonly summary: SupportSummaryService,
  ) {}

  async sweep(now = new Date()) {
    const closed = await this.closeIdle(now);
    const { count: deleted } = await this.prisma.supportConversation.deleteMany({
      where: { lastMessageAt: { lt: new Date(now.getTime() - RETENTION_DAYS * DAY_MS) } },
    });
    return { closed, deleted };
  }

  private async closeIdle(now: Date): Promise<number> {
    const idle = await this.prisma.supportConversation.findMany({
      where: {
        status: { not: 'CLOSED' },
        lastMessageAt: { lt: new Date(now.getTime() - IDLE_CLOSE_HOURS * HOUR_MS) },
        // One nobody wrote in isn't history to close: it just goes with the retention.
        messages: { some: {} },
      },
      orderBy: { lastMessageAt: 'asc' },
      take: CLOSE_BATCH,
      select: { id: true, handedOffAt: true },
    });
    let closed = 0;
    for (const { id, handedOffAt } of idle) {
      try {
        const done = await this.prisma.$transaction(async (tx) => {
          // Checked again: a message or a close since the read wins.
          const { count } = await tx.supportConversation.updateMany({
            where: { id, status: { not: 'CLOSED' }, lastMessageAt: { lt: new Date(now.getTime() - IDLE_CLOSE_HOURS * HOUR_MS) } },
            data: { status: 'CLOSED', closedAt: now, staffUnread: false },
          });
          if (count === 0) return false;
          // lastMessageAt stays: the week's retention counts from the last real message.
          await tx.supportMessage.create({ data: { conversationId: id, role: 'SYSTEM', body: AUTO_CLOSED, createdAt: now } });
          return true;
        });
        if (!done) continue;
        closed++;
        await this.events.publish(id, 'status', { status: 'CLOSED' });
        if (handedOffAt) {
          await this.inapp.removeBySubject(supportSubject(id));
          // Only a conversation the team handled is summarised by email: an assistant-only chat closing isn't news.
          await this.summary.sendFor(id);
        }
      } catch (error) {
        this.logger.error(`Closing idle support conversation ${id} failed: ${(error as Error).message}`);
      }
    }
    return closed;
  }
}

/**
 * The sweep with what closing needs. The live events, the model chain and the closing summary live here, exported,
 * so the support module and the maintenance queue share one of each.
 */
@Module({
  imports: [DatabaseModule, NotificationModule],
  providers: [SupportSweepService, SupportEventsService, SupportChainService, SupportSummaryService],
  exports: [SupportSweepService, SupportEventsService, SupportChainService, SupportSummaryService],
})
export class SupportSweepModule {}
