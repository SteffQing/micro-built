import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { visibleEmail } from '@microbuilt/shared';
import type { SupportStatus } from '@prisma/client';
import { AuditService } from 'src/audit/audit.service';
import type { AuthUser } from 'src/common/types';
import { PrismaService } from 'src/database/prisma.service';
import { AdminNotifierService } from 'src/notifications/admin-notifier.service';
import { InappService } from 'src/notifications/inapp.service';
import { MailService } from 'src/notifications/mail.service';
import { SmsService } from 'src/notifications/sms.service';
import { siteUrl } from 'src/notifications/templates/shared';
import { canHandoff, type SupportCaller } from './caller';
import { inboxLink, requesterLink, supportSubject, visitorLink } from './paths';
import { SupportEventsService } from './support-events.service';
import { SupportSummaryService } from './support-summary.service';
import type { SupportConversationDto, SupportHandoffDto, SupportMessageDto } from './support.dto';
import { PUBLIC_CONVERSATION, PUBLIC_MESSAGE, SupportService, firstName } from './support.service';

export const PASSED_TO_TEAM = 'Passed to the team';
/** The line in the thread when a responder claims it, or takes it over from someone else. */
export const joinedLine = (name: string, from?: string) =>
  from ? `${name} took over from ${from}` : `${name} joined the chat`;
/** The line in the thread when someone closes it. */
export const closedLine = (name?: string) => `${name ?? 'The requester'} closed the chat`;
/** What a responder says first when they claim a conversation, before they have read it. */
export const greeting = (staff: string, requester?: string) =>
  `Hi${requester ? ` ${requester}` : ' there'}, I'm ${staff} from the MicroBuilt team. Give me a minute to read through ` +
  `the conversation so far and I'll get right back to you.`;
export const RESPONDERS = ['ADMIN', 'SUPER_ADMIN'] as const;


const WITH_TEAM: SupportStatus[] = ['HANDOFF', 'ASSIGNED'];
const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: 'A customer',
  MARKETER: 'A marketer',
};

const preview = (text: string, max = 160) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
};

// A conversation passed to staff (CHAT_SUPPORT.md §1.7): the requester hands off, responders hear of it (in-app over
// the live stream, and by email), any responder claims it and replies in the thread, and the requester hears back
// in-app and by email (a visitor by email or SMS). While it is with the team the assistant is silent.
@Injectable()
export class SupportHandoffService {
  private readonly logger = new Logger(SupportHandoffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly support: SupportService,
    private readonly admins: AdminNotifierService,
    private readonly inapp: InappService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
    private readonly audit: AuditService,
    private readonly events: SupportEventsService,
    private readonly summary: SupportSummaryService,
  ) {}

  /** Idempotent: a conversation already with the team is returned as it is. */
  async handoff(caller: SupportCaller, id: string, dto: SupportHandoffDto): Promise<SupportConversationDto> {
    if (!canHandoff(caller)) {
      throw new ForbiddenException('Admins answer support conversations; there is no one to pass this to.');
    }
    const conversation = await this.support.owned(caller, id);
    if (WITH_TEAM.includes(conversation.status)) return this.dto(id);
    if (conversation.status === 'CLOSED') {
      throw new ConflictException('This conversation is closed. Start a new one to reach the team.');
    }
    if (!caller.user && !dto.contactEmail && !dto.contactPhone) {
      throw new BadRequestException('Leave an email address or phone number so the team can reply');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.supportConversation.updateMany({
        where: { id, status: 'AI' },
        data: {
          status: 'HANDOFF',
          handedOffAt: now,
          lastMessageAt: now,
          staffUnread: true,
          ...(!caller.user && {
            contactName: dto.contactName ?? null,
            contactEmail: dto.contactEmail ?? null,
            contactPhone: dto.contactPhone ?? null,
          }),
        },
      });
      if (count === 0) return null;
      await tx.supportMessage.create({ data: { conversationId: id, role: 'SYSTEM', body: PASSED_TO_TEAM, createdAt: now } });
      if (dto.note) {
        await tx.supportMessage.create({
          data: { conversationId: id, role: 'USER', body: dto.note, createdAt: new Date(now.getTime() + 1) },
        });
      }
      return tx.supportConversation.findUniqueOrThrow({ where: { id }, select: PUBLIC_CONVERSATION });
    });
    // Handed off at the same moment by another tab: the first one did the telling.
    if (!updated) return this.dto(id);

    await this.events.publish(id, 'status', { status: updated.status });
    // Emails to every responder take a while: the requester doesn't wait for them.
    void this.tellResponders(id, caller, updated.title, dto).catch((error: Error) =>
      this.logger.error(`Telling responders about ${id} failed: ${error.message}`),
    );
    return updated;
  }

  /** A requester wrote while it is with the team: the assignee (or every responder, when unassigned) is told again. */
  async nudge(id: string): Promise<void> {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id },
      select: { title: true, assigneeId: true },
    });
    if (!conversation) return;
    const notice = {
      title: 'New message in a support conversation',
      message: `“${conversation.title}” has a new message from the requester.`,
      callToActionUrl: inboxLink(id),
      subject: supportSubject(id),
    };
    try {
      // One prompt per conversation: the old one goes as the new one arrives.
      await this.admins.clear(supportSubject(id));
      if (conversation.assigneeId) await this.inapp.messageUser({ userId: conversation.assigneeId, ...notice });
      else await this.admins.notifyAdmins([...RESPONDERS], { ...notice, ctaUrl: notice.callToActionUrl });
    } catch (error) {
      this.logger.error(`Support nudge for ${id} failed: ${(error as Error).message}`);
    }
  }

  /**
   * → ASSIGNED to `staff`. Another responder can take it over; the audit log shows who. The thread shows who joined
   * and, unless they are claiming it by replying, a greeting from them while they read up.
   */
  async claim(staff: AuthUser, id: string, { greet = true }: { greet?: boolean } = {}): Promise<SupportConversationDto> {
    const conversation = await this.staffConversation(id);
    if (conversation.status === 'CLOSED') throw new ConflictException('This conversation is closed');
    if (conversation.status === 'AI') throw new ConflictException('This conversation has not been passed to the team');
    if (conversation.status === 'ASSIGNED' && conversation.assigneeId === staff.userId) return this.dto(id);

    const previous = conversation.assigneeId
      ? await this.prisma.user.findUnique({ where: { id: conversation.assigneeId }, select: { name: true } })
      : null;
    const me = await this.prisma.user.findUnique({ where: { id: staff.userId }, select: { name: true } });
    const name = firstName(me?.name) ?? 'Someone from the team';
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.supportMessage.create({
        data: { conversationId: id, role: 'SYSTEM', body: joinedLine(name, firstName(previous?.name)), createdAt: now },
      });
      if (greet) {
        await tx.supportMessage.create({
          data: {
            conversationId: id,
            role: 'STAFF',
            body: greeting(name, firstName(conversation.user?.name ?? conversation.contactName)),
            authorId: staff.userId,
            createdAt: new Date(now.getTime() + 1),
          },
        });
      }
      const row = await tx.supportConversation.update({
        where: { id },
        data: { status: 'ASSIGNED', assigneeId: staff.userId, lastMessageAt: now, ...(greet && { requesterUnread: true }) },
        select: PUBLIC_CONVERSATION,
      });
      await this.audit.record(
        {
          actorId: staff.userId,
          action: 'SUPPORT_CLAIMED',
          entityType: 'SUPPORT_CONVERSATION',
          entityId: id,
          note: previous ? `${conversation.title} (taken over from ${previous.name})` : conversation.title,
        },
        tx,
      );
      return row;
    });
    await this.admins.clear(supportSubject(id));
    await this.events.publish(id, 'status', { status: updated.status });
    return updated;
  }

  /** A staff reply: allowed while it is with the team (claiming it first when nobody has). */
  async reply(staff: AuthUser, id: string, text: string): Promise<SupportMessageDto> {
    let conversation = await this.staffConversation(id);
    if (conversation.status === 'CLOSED') throw new ConflictException('This conversation is closed');
    if (conversation.status === 'AI') throw new ConflictException('This conversation has not been passed to the team');
    if (conversation.status === 'HANDOFF') {
      // Their reply is the greeting.
      await this.claim(staff, id, { greet: false });
      conversation = await this.staffConversation(id);
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const row = await tx.supportMessage.create({
        data: { conversationId: id, role: 'STAFF', body: text, authorId: staff.userId },
        select: PUBLIC_MESSAGE,
      });
      await tx.supportConversation.update({
        where: { id },
        data: { lastMessageAt: row.createdAt, requesterUnread: true, staffUnread: false },
      });
      return row;
    });
    const [dto] = await this.support.toMessages([message]);
    await this.events.publish(id, 'message', { messageId: dto.id });
    // In-app, then email or SMS: it never throws, and the responder doesn't wait for it.
    void this.tellRequester(conversation, dto);
    return dto;
  }

  async close(staff: AuthUser, id: string): Promise<SupportConversationDto> {
    const conversation = await this.staffConversation(id);
    if (conversation.status === 'CLOSED') return this.dto(id);
    const me = await this.prisma.user.findUnique({ where: { id: staff.userId }, select: { name: true } });
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.supportMessage.create({
        data: { conversationId: id, role: 'SYSTEM', body: closedLine(firstName(me?.name) ?? 'The team'), createdAt: now },
      });
      const row = await tx.supportConversation.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: now, lastMessageAt: now, staffUnread: false, requesterUnread: true },
        select: PUBLIC_CONVERSATION,
      });
      await this.audit.record(
        {
          actorId: staff.userId,
          action: 'SUPPORT_CLOSED',
          entityType: 'SUPPORT_CONVERSATION',
          entityId: id,
          note: conversation.title,
        },
        tx,
      );
      return row;
    });
    await this.admins.clear(supportSubject(id));
    await this.events.publish(id, 'status', { status: updated.status });
    void this.summary.sendFor(id);
    return updated;
  }

  /** The requester ends their own conversation, with the assistant or with the team. Idempotent. */
  async closeOwn(caller: SupportCaller, id: string): Promise<SupportConversationDto> {
    const conversation = await this.support.owned(caller, id);
    if (conversation.status === 'CLOSED') return this.dto(id);
    const withTeam = WITH_TEAM.includes(conversation.status);
    const row = await this.prisma.supportConversation.findUniqueOrThrow({
      where: { id },
      select: { contactName: true, user: { select: { name: true } } },
    });
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.supportMessage.create({
        data: { conversationId: id, role: 'SYSTEM', body: closedLine(firstName(row.user?.name ?? row.contactName)), createdAt: now },
      });
      return tx.supportConversation.update({
        where: { id },
        // The team sees it closed in the inbox; one closed before anyone answered is no longer waiting.
        data: { status: 'CLOSED', closedAt: now, lastMessageAt: now, ...(withTeam && { staffUnread: true }) },
        select: PUBLIC_CONVERSATION,
      });
    });
    if (withTeam) await this.admins.clear(supportSubject(id));
    await this.events.publish(id, 'status', { status: updated.status });
    void this.summary.sendFor(id);
    return updated;
  }

  private async dto(id: string): Promise<SupportConversationDto> {
    return this.prisma.supportConversation.findUniqueOrThrow({ where: { id }, select: PUBLIC_CONVERSATION });
  }

  private async staffConversation(id: string) {
    const conversation = await this.prisma.supportConversation.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        assigneeId: true,
        userId: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        user: { select: { name: true, email: true, phoneNumber: true } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  /** In-app (live over the notification stream, cleared on claim) and an email to every active responder. */
  private async tellResponders(id: string, caller: SupportCaller, title: string, { note, contactName }: SupportHandoffDto) {
    const name = caller.user
      ? (await this.prisma.user.findUnique({ where: { id: caller.user.userId }, select: { name: true } }))?.name
      : undefined;
    const requester = caller.user
      ? (name ?? ROLE_LABEL[caller.audience] ?? 'A user')
      : contactName
        ? `${contactName} (a visitor)`
        : 'A visitor';
    try {
      await this.admins.notifyAdmins([...RESPONDERS], {
        title: 'A support conversation is waiting',
        message: `${requester} passed “${title}” to the team. Claim it to reply.`,
        ctaUrl: inboxLink(id),
        subject: supportSubject(id),
      });
    } catch (error) {
      this.logger.error(`Telling responders about ${id} failed: ${(error as Error).message}`);
    }
    const responders = await this.prisma.admin.findMany({
      where: { role: { in: [...RESPONDERS] }, user: { status: 'ACTIVE' } },
      select: { user: { select: { name: true, email: true } } },
    });
    await Promise.all(
      responders.map(async ({ user }) => {
        const email = visibleEmail(user.email);
        if (!email) return;
        try {
          await this.mail.sendSupportHandoff(email, {
            name: firstName(user.name),
            requester,
            title,
            note,
            url: `${siteUrl}${inboxLink(id)}`,
          });
        } catch (error) {
          this.logger.error(`Support handoff email failed: ${(error as Error).message}`);
        }
      }),
    );
  }

  /**
   * A user: in-app, then email when they have a real address, otherwise SMS (the customer notifier's rule). A visitor:
   * the email or phone they left. Never throws: the reply is already in the thread.
   */
  private async tellRequester(
    conversation: Awaited<ReturnType<SupportHandoffService['staffConversation']>>,
    reply: SupportMessageDto,
  ) {
    const { id, title } = conversation;
    const from = reply.authorName;
    try {
      if (conversation.userId && conversation.user) {
        await this.inapp.messageUser({
          userId: conversation.userId,
          title: 'The team replied',
          message: `${from ? `${from}: ` : ''}${preview(reply.body)}`,
          callToActionUrl: requesterLink(id),
        });
        const email = visibleEmail(conversation.user.email);
        if (email) {
          await this.mail.sendSupportReply(email, {
            name: firstName(conversation.user.name),
            from,
            title,
            reply: reply.body,
            url: `${siteUrl}${requesterLink(id)}`,
          });
        } else if (conversation.user.phoneNumber) {
          await this.sms.send(conversation.user.phoneNumber, this.smsText(reply.body, requesterLink(id)));
        }
        return;
      }
      if (conversation.contactEmail) {
        await this.mail.sendSupportReply(conversation.contactEmail, {
          name: firstName(conversation.contactName),
          from,
          title,
          reply: reply.body,
          url: `${siteUrl}${visitorLink(id)}`,
        });
      } else if (conversation.contactPhone) {
        await this.sms.send(conversation.contactPhone, this.smsText(reply.body, visitorLink(id)));
      }
    } catch (error) {
      this.logger.error(`Telling the requester of ${id} about a reply failed: ${(error as Error).message}`);
    }
  }

  private smsText(body: string, link: string) {
    return `MicroBuilt Prime support: ${preview(body, 300)} Reply: ${siteUrl}${link}`;
  }
}
