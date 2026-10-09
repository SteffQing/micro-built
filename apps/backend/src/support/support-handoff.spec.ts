jest.mock('src/auth/auth-accounts.service', () => ({ AuthAccountsService: class {} }));
jest.mock('src/notifications/mail.service', () => ({ MailService: class {} }));

import { BadRequestException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/auth/decorators';
import type { AuthUser } from 'src/common/types';
import type { SupportCaller } from './caller';
import { SupportAdminController } from './support-admin.controller';
import { PASSED_TO_TEAM, SupportHandoffService, greeting } from './support-handoff.service';
import { AUTO_CLOSED, IDLE_CLOSE_HOURS, RETENTION_DAYS, SupportSweepService } from './support-sweep.service';
import { SupportService } from './support.service';

const customer = { audience: 'CUSTOMER', restricted: false, user: { userId: 'u1' }, visitorId: null, ip: null } as SupportCaller;
const visitor = { audience: 'ANONYMOUS', restricted: false, user: null, visitorId: 'v1', ip: '1.1.1.1' } as SupportCaller;
const admin = { audience: 'ADMIN', restricted: false, user: { userId: 'a1' }, visitorId: null, ip: null } as SupportCaller;
const staff = { userId: 'a1', role: 'ADMIN' } as AuthUser;
/** The requester and responders are told in the background: let it run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

function setup(conversation: Record<string, unknown> = {}) {
  const row = {
    id: 'c1',
    title: 'My June deduction',
    status: 'AI',
    audience: 'CUSTOMER',
    userId: 'u1',
    visitorId: null,
    assigneeId: null,
    contactEmail: null,
    contactPhone: null,
    user: { name: 'Ada Obi', email: 'ada@example.com', phoneNumber: '+2348031234567' },
    ...conversation,
  };
  const messages: Record<string, unknown>[] = [];
  const tx = {
    supportConversation: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(row, data)),
      findUniqueOrThrow: jest.fn(async () => ({ ...row, status: 'HANDOFF' })),
    },
    supportMessage: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const message = { id: `m${messages.length + 1}`, rating: null, offerHandoff: false, createdAt: new Date(), ...data };
        messages.push(message);
        return message;
      }),
    },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    supportConversation: {
      ...tx.supportConversation,
      findFirst: jest.fn(async () => row),
      findUnique: jest.fn(async () => row),
      findUniqueOrThrow: jest.fn(async () => row),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({
        name: { a1: 'Tunde Bello', a2: 'Kemi Ade' }[where.id] ?? 'Ada Obi',
      })),
      findMany: jest.fn().mockResolvedValue([{ id: 'a1', name: 'Tunde Bello' }]),
    },
    admin: {
      findMany: jest.fn().mockResolvedValue([
        { user: { name: 'Tunde Bello', email: 'tunde@microbuilt.test' } },
        { user: { name: 'Phone Only', email: '2348031234567@phone.microbuiltprime.com' } },
      ]),
    },
  };
  const admins = { notifyAdmins: jest.fn(), clear: jest.fn() };
  const inapp = { messageUser: jest.fn(), replaceUnread: jest.fn(), markSubjectRead: jest.fn() };
  const audit = { record: jest.fn() };
  const events = { publish: jest.fn() };
  const summary = { sendFor: jest.fn() };
  const lifecycle = { scheduleClose: jest.fn(), scheduleDelete: jest.fn() };
  const support = new SupportService(prisma as never, {} as never, inapp as never, lifecycle as never);
  const service = new SupportHandoffService(
    prisma as never,
    support,
    admins as never,
    inapp as never,
    audit as never,
    events as never,
    summary as never,
    lifecycle as never,
  );
  return { service, prisma, tx, row, messages, admins, inapp, audit, events, summary, lifecycle };
}

beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));

describe('handoff', () => {
  it("needs a visitor's email or phone, not a signed-in user's", async () => {
    const { service, tx } = setup({ userId: null, visitorId: 'v1', user: null, audience: 'ANONYMOUS' });
    await expect(service.handoff(visitor, 'c1', {})).rejects.toThrow(BadRequestException);
    expect(tx.supportConversation.updateMany).not.toHaveBeenCalled();
    await service.handoff(visitor, 'c1', { contactEmail: 'ada@example.com' });
    expect(tx.supportConversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1', status: 'AI' },
        data: expect.objectContaining({ status: 'HANDOFF', contactEmail: 'ada@example.com', contactPhone: null, staffUnread: true }),
      }),
    );
  });

  it('passes it on, tells every responder in-app (by subject, no email), and is idempotent', async () => {
    const { service, messages, admins, events, row } = setup();
    await service.handoff(customer, 'c1', { note: 'June looks wrong' });
    await settle();
    expect(messages.map((m) => [m.role, m.body])).toEqual([
      ['SYSTEM', PASSED_TO_TEAM],
      ['USER', 'June looks wrong'],
    ]);
    expect(admins.notifyAdmins).toHaveBeenCalledWith(
      ['ADMIN', 'SUPER_ADMIN'],
      expect.objectContaining({ subject: 'support:c1', ctaUrl: '/support-inbox/c1' }),
    );
    expect(admins.notifyAdmins.mock.calls[0][1].message).toMatch(/^Ada Obi passed “My June deduction” to the team\. “June looks wrong”/);
    expect(events.publish).toHaveBeenCalledWith('c1', 'status', { status: 'HANDOFF' });

    row.status = 'HANDOFF';
    admins.notifyAdmins.mockClear();
    await service.handoff(customer, 'c1', {});
    expect(admins.notifyAdmins).not.toHaveBeenCalled();
  });

  it("isn't for the responders themselves, nor a closed conversation", async () => {
    await expect(setup().service.handoff(admin, 'c1', {})).rejects.toThrow(ForbiddenException);
    await expect(setup({ status: 'CLOSED' }).service.handoff(customer, 'c1', {})).rejects.toThrow(ConflictException);
  });
});

describe('claim, reply, close', () => {
  it('claims: assigned, the prompt cleared for everyone, audited, and the requester greeted', async () => {
    const { service, row, admins, audit, messages } = setup({ status: 'HANDOFF' });
    await service.claim(staff, 'c1');
    expect(row).toMatchObject({ status: 'ASSIGNED', assigneeId: 'a1', requesterUnread: true });
    expect(messages.map((m) => [m.role, m.body])).toEqual([
      ['SYSTEM', 'Tunde joined the chat'],
      ['STAFF', greeting('Tunde', 'Ada')],
    ]);
    expect(messages[1]).toMatchObject({ authorId: 'a1' });
    expect(admins.clear).toHaveBeenCalledWith('support:c1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SUPPORT_CLAIMED', entityType: 'SUPPORT_CONVERSATION', entityId: 'c1' }),
      expect.anything(),
    );
  });

  it('says who took it over from whom', async () => {
    const { service, messages } = setup({ status: 'ASSIGNED', assigneeId: 'a2', userId: null, user: null, contactName: 'Bola Musa' });
    await service.claim(staff, 'c1');
    expect(messages.map((m) => m.body)).toEqual(['Tunde took over from Kemi', greeting('Tunde', 'Bola')]);
  });

  it("won't claim or reply to one that isn't with the team", async () => {
    const { service } = setup({ status: 'AI' });
    await expect(service.claim(staff, 'c1')).rejects.toThrow(ConflictException);
    await expect(service.reply(staff, 'c1', 'hi')).rejects.toThrow(ConflictException);
  });

  it('tells a user in-app only: one notification per conversation, no email or SMS', async () => {
    const { service, inapp, events, messages } = setup({ status: 'ASSIGNED', assigneeId: 'a1' });
    const reply = await service.reply(staff, 'c1', 'Your June deduction is fixed.');
    await settle();
    expect(reply).toMatchObject({ role: 'STAFF', authorName: 'Tunde' });
    expect(messages[0]).toMatchObject({ role: 'STAFF', authorId: 'a1' });
    expect(events.publish).toHaveBeenCalledWith('c1', 'message', { messageId: reply.id });
    // It replaces the unread one about the same conversation.
    expect(inapp.replaceUnread).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', callToActionUrl: '/dashboard?support=c1', subject: 'support-reply:c1' }),
    );
  });

  it('claims a waiting one first; a visitor reads the reply on /support', async () => {
    const visitorRow = setup({ status: 'HANDOFF', userId: null, user: null, contactEmail: 'v@example.com' });
    await visitorRow.service.reply(staff, 'c1', 'Hello');
    await settle();
    expect(visitorRow.row).toMatchObject({ status: 'ASSIGNED', assigneeId: 'a1' });
    // Claimed by replying: their reply is the greeting.
    expect(visitorRow.messages.map((m) => [m.role, m.body])).toEqual([
      ['SYSTEM', 'Tunde joined the chat'],
      ['STAFF', 'Hello'],
    ]);
    expect(visitorRow.inapp.replaceUnread).not.toHaveBeenCalled();
  });

  it('closes, audited, says who closed it, sends the summary, and closing again changes nothing', async () => {
    const { service, row, audit, messages, summary, lifecycle } = setup({ status: 'ASSIGNED' });
    await service.close(staff, 'c1');
    expect(row.status).toBe('CLOSED');
    expect(messages.map((m) => [m.role, m.body])).toEqual([['SYSTEM', 'Tunde closed the chat']]);
    expect(summary.sendFor).toHaveBeenCalledWith('c1');
    expect(lifecycle.scheduleDelete).toHaveBeenCalledWith('c1', expect.any(Date));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'SUPPORT_CLOSED' }), expect.anything());
    audit.record.mockClear();
    await service.close(staff, 'c1');
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('closeOwn', () => {
  it('lets the requester end it, with the assistant or with the team, once', async () => {
    const { service, row, messages, summary, admins, lifecycle } = setup({ status: 'HANDOFF', handedOffAt: new Date() });
    await service.closeOwn(customer, 'c1');
    expect(row).toMatchObject({ status: 'CLOSED', staffUnread: true });
    expect(messages.map((m) => m.body)).toEqual(['Ada closed the chat']);
    expect(admins.clear).toHaveBeenCalledWith('support:c1');
    expect(summary.sendFor).toHaveBeenCalledWith('c1');
    expect(lifecycle.scheduleDelete).toHaveBeenCalledWith('c1', expect.any(Date));

    summary.sendFor.mockClear();
    await service.closeOwn(customer, 'c1');
    expect(summary.sendFor).not.toHaveBeenCalled();
  });
});

describe('the staff inbox', () => {
  it('is for admins and super admins, and its analytics for super admins only', () => {
    const reflector = new Reflector();
    expect(reflector.get(ROLES_KEY, SupportAdminController)).toEqual(['ADMIN', 'SUPER_ADMIN']);
    expect(reflector.get(ROLES_KEY, SupportAdminController.prototype.analytics)).toEqual(['SUPER_ADMIN']);
    expect(reflector.get(ROLES_KEY, SupportAdminController.prototype.reply)).toBeUndefined();
  });
});

describe('SupportSweepService (the conversation lifecycle)', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  const hoursAgo = (n: number) => new Date(now.getTime() - n * 60 * 60 * 1000);

  function lifecycleSetup(conversation: Record<string, unknown> | null, closes = true) {
    const created: Record<string, unknown>[] = [];
    const tx = {
      supportConversation: { updateMany: jest.fn().mockResolvedValue({ count: closes ? 1 : 0 }) },
      supportMessage: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => created.push(data)) },
    };
    const prisma = {
      supportConversation: {
        findUnique: jest.fn().mockResolvedValue(conversation),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const inapp = { removeBySubject: jest.fn() };
    const events = { publish: jest.fn() };
    const summary = { sendFor: jest.fn() };
    const queue = { add: jest.fn() };
    const service = new SupportSweepService(prisma as never, inapp as never, events as never, summary as never, queue as never);
    return { service, prisma, created, inapp, events, summary, queue };
  }
  const open = (over: Record<string, unknown> = {}) => ({
    status: 'ASSIGNED',
    lastMessageAt: hoursAgo(30),
    handedOffAt: hoursAgo(40),
    _count: { messages: 4 },
    ...over,
  });

  it('closes one a day past its last message, then queues its deletion a week on', async () => {
    const { service, created, events, inapp, summary, queue } = lifecycleSetup(open());
    expect(await service.closeIfIdle('c1', now)).toBe('closed');
    expect(created).toEqual([expect.objectContaining({ conversationId: 'c1', role: 'SYSTEM', body: AUTO_CLOSED })]);
    expect(events.publish).toHaveBeenCalledWith('c1', 'status', { status: 'CLOSED' });
    // The team handled it: the admins' prompt goes and the summary is emailed.
    expect(inapp.removeBySubject).toHaveBeenCalledWith('support:c1');
    expect(summary.sendFor).toHaveBeenCalledWith('c1');
    const at = now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000;
    expect(queue.add).toHaveBeenCalledWith(
      'support_delete',
      { conversationId: 'c1' },
      expect.objectContaining({ jobId: `support_delete:c1:${at}` }),
    );
  });

  it('moves the check to 24 hours after the last message while it is written in', async () => {
    const last = hoursAgo(5);
    const { service, created, queue } = lifecycleSetup(open({ lastMessageAt: last }));
    expect(await service.closeIfIdle('c1', now)).toBe('extended');
    expect(created).toEqual([]);
    const at = last.getTime() + IDLE_CLOSE_HOURS * 60 * 60 * 1000;
    expect(queue.add).toHaveBeenCalledWith(
      'support_close',
      { conversationId: 'c1' },
      expect.objectContaining({ jobId: `support_close:c1:${at}` }),
    );
  });

  it("closes an assistant-only one without email, deletes one nobody wrote in, and leaves a closed one", async () => {
    const aiOnly = lifecycleSetup(open({ handedOffAt: null }));
    expect(await aiOnly.service.closeIfIdle('c1', now)).toBe('closed');
    expect(aiOnly.summary.sendFor).not.toHaveBeenCalled();

    const empty = lifecycleSetup(open({ _count: { messages: 0 } }));
    expect(await empty.service.closeIfIdle('c1', now)).toBe('deleted');
    expect(empty.prisma.supportConversation.deleteMany).toHaveBeenCalledWith({ where: { id: 'c1', messages: { none: {} } } });

    expect(await lifecycleSetup(open({ status: 'CLOSED' })).service.closeIfIdle('c1', now)).toBe('gone');
  });

  it('deletes only a conversation closed at least a week ago', async () => {
    const { service, prisma } = lifecycleSetup(null);
    await service.deleteIfDue('c1', now);
    expect(prisma.supportConversation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'c1', status: 'CLOSED', closedAt: { lte: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    });
  });

  it('catches up daily on whatever a lost job left', async () => {
    const { service, prisma } = lifecycleSetup(open());
    prisma.supportConversation.findMany.mockResolvedValue([{ id: 'c1' }]);
    expect(await service.catchUp(now)).toEqual({ closed: 1, deleted: 1 });
    expect(prisma.supportConversation.deleteMany).toHaveBeenLastCalledWith({
      where: { status: 'CLOSED', closedAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    });
  });
});
