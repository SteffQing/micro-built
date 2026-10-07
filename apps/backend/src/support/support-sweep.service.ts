import { Injectable, Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { PrismaService } from 'src/database/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = {
  /** A signed-in user's conversation that never reached the team, after its last message. */
  aiOnly: 90,
  /** One that reached the team, after it was closed. */
  handedOff: 365,
  /** A visitor's, after its last message. */
  visitor: 30,
} as const;

/**
 * The daily retention sweep (CHAT_SUPPORT.md C9, §1.8): deletes old conversations; their messages cascade. Its own
 * module, so the maintenance queue can run it without importing the whole support module.
 */
@Injectable()
export class SupportSweepService {
  constructor(private readonly prisma: PrismaService) {}

  async sweep(now = new Date()) {
    const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const [aiOnly, handedOff, visitors] = await this.prisma.$transaction([
      this.prisma.supportConversation.deleteMany({
        where: { userId: { not: null }, handedOffAt: null, lastMessageAt: { lt: before(RETENTION_DAYS.aiOnly) } },
      }),
      this.prisma.supportConversation.deleteMany({
        where: {
          userId: { not: null },
          handedOffAt: { not: null },
          status: 'CLOSED',
          closedAt: { lt: before(RETENTION_DAYS.handedOff) },
        },
      }),
      this.prisma.supportConversation.deleteMany({
        where: { visitorId: { not: null }, lastMessageAt: { lt: before(RETENTION_DAYS.visitor) } },
      }),
    ]);
    return { aiOnly: aiOnly.count, handedOff: handedOff.count, visitors: visitors.count };
  }
}

@Module({
  imports: [DatabaseModule],
  providers: [SupportSweepService],
  exports: [SupportSweepService],
})
export class SupportSweepModule {}
