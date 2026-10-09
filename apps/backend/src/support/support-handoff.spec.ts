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
  const mail = { sendSupportReply: jest.fn(), sendSupportHandoff: jest.fn() };
  const sms = { send: jest.fn() };
  const audit = { record: jest.fn() };
  const events = { publish: jest.fn() };
  const summary = { sendFor: jest.fn() };
  const support = new SupportService(prisma as never, {} as never, inapp as never);
  const service = new SupportHandoffService(
    prisma as never,
    support,
    admins as never,
    inapp as never,
    mail as never,
    sms as never,
    audit as never,
    events as never,
    summary as never,
  );
  return { service, prisma, tx, row, messages, admins, inapp, mail, sms, audit, events, summary };
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

  it('passes it on, tells every responder in-app (by subject) and by email, and is idempotent', async () => {
    const { service, messages, admins, mail, events, row } = setup();
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
    // A placeholder address (phone-only account) is never mailed.
    expect(mail.sendSupportHandoff).toHaveBeenCalledTimes(1);
    expect(mail.sendSupportHandoff).toHaveBeenCalledWith('tunde@microbuilt.test', expect.objectContaining({ requester: 'Ada Obi' }));
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
    expect(row).toMatchObject({ status: 'ASSIGNED', assigneeId: 'a1' });
    // The greeting isn't a reply to email about: the first real one decides that.
    expect(row).not.toHaveProperty('requesterUnread');
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

  it('tells a user in-app and by email', async () => {
    const { service, inapp, mail, sms, events, messages } = setup({ status: 'ASSIGNED', assigneeId: 'a1' });
    const reply = await service.reply(staff, 'c1', 'Your June deduction is fixed.');
    await settle();
    expect(reply).toMatchObject({ role: 'STAFF', authorName: 'Tunde' });
    expect(messages[0]).toMatchObject({ role: 'STAFF', authorId: 'a1' });
    expect(events.publish).toHaveBeenCalledWith('c1', 'message', { messageId: reply.id });
    // One notification per conversation: it replaces the unread one about the same conversation.
    expect(inapp.replaceUnread).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', callToActionUrl: '/dashboard?support=c1', subject: 'support-reply:c1' }),
    );
    expect(mail.sendSupportReply).toHaveBeenCalledWith(
      'ada@example.com',
      expect.objectContaining({ from: 'Tunde', reply: 'Your June deduction is fixed.', url: expect.stringMatching(/\/dashboard\?support=c1$/) }),
    );
    expect(sms.send).not.toHaveBeenCalled();
  });

  it("doesn't email again while an earlier reply is unread; the notification is still replaced", async () => {
    const { service, inapp, mail } = setup({ status: 'ASSIGNED', assigneeId: 'a1', requesterUnread: true });
    await service.reply(staff, 'c1', 'One more thing.');
    await settle();
    expect(inapp.replaceUnread).toHaveBeenCalledTimes(1);
    expect(mail.sendSupportReply).not.toHaveBeenCalled();
  });

  it('texts a phone-only user', async () => {
    const { service, mail, sms } = setup({
      status: 'ASSIGNED',
      user: { name: 'Ada', email: '2348031234567@phone.microbuiltprime.com', phoneNumber: '+2348031234567' },
    });
    await service.reply(staff, 'c1', 'Done.');
    await settle();
    expect(mail.sendSupportReply).not.toHaveBeenCalled();
    expect(sms.send).toHaveBeenCalledWith('+2348031234567', expect.stringContaining('Done.'));
  });

  it('emails a visitor who left an email, texts one who left a phone, and claims a waiting one first', async () => {
    const emailed = setup({ status: 'HANDOFF', userId: null, user: null, contactEmail: 'v@example.com' });
    await emailed.service.reply(staff, 'c1', 'Hello');
    await settle();
    expect(emailed.row).toMatchObject({ status: 'ASSIGNED', assigneeId: 'a1' });
    // Claimed by replying: their reply is the greeting.
    expect(emailed.messages.map((m) => [m.role, m.body])).toEqual([
      ['SYSTEM', 'Tunde joined the chat'],
      ['STAFF', 'Hello'],
    ]);
    expect(emailed.inapp.replaceUnread).not.toHaveBeenCalled();
    expect(emailed.mail.sendSupportReply).toHaveBeenCalledWith(
      'v@example.com',
      expect.objectContaining({ url: expect.stringMatching(/\/support\?c=c1$/) }),
    );

    const texted = setup({ status: 'ASSIGNED', userId: null, user: null, contactPhone: '+2348031234567' });
    await texted.service.reply(staff, 'c1', 'Hello');
    await settle();
    expect(texted.sms.send).toHaveBeenCalledWith('+2348031234567', expect.stringContaining('/support?c=c1'));
  });

  it('closes, audited, says who closed it, sends the summary, and closing again changes nothing', async () => {
    const { service, row, audit, messages, summary } = setup({ status: 'ASSIGNED' });
    await service.close(staff, 'c1');
    expect(row.status).toBe('CLOSED');
    expect(messages.map((m) => [m.role, m.body])).toEqual([['SYSTEM', 'Tunde closed the chat']]);
    expect(summary.sendFor).toHaveBeenCalledWith('c1');
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'SUPPORT_CLOSED' }), expect.anything());
    audit.record.mockClear();
    await service.close(staff, 'c1');
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('closeOwn', () => {
  it('lets the requester end it, with the assistant or with the team, once', async () => {
    const { service, row, messages, summary, admins } = setup({ status: 'HANDOFF', handedOffAt: new Date() });
    await service.closeOwn(customer, 'c1');
    expect(row).toMatchObject({ status: 'CLOSED', staffUnread: true });
    expect(messages.map((m) => m.body)).toEqual(['Ada closed the chat']);
    expect(admins.clear).toHaveBeenCalledWith('support:c1');
    expect(summary.sendFor).toHaveBeenCalledWith('c1');

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

describe('SupportSweepService', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  const hoursAgo = (n: number) => new Date(now.getTime() - n * 60 * 60 * 1000);

  function sweepSetup(idle: { id: string; handedOffAt: Date | null }[], closes = true) {
    const created: Record<string, unknown>[] = [];
    const tx = {
      supportConversation: { updateMany: jest.fn().mockResolvedValue({ count: closes ? 1 : 0 }) },
      supportMessage: { create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => created.push(data)) },
    };
    const prisma = {
      supportConversation: {
        findMany: jest.fn().mockResolvedValue(idle),
        deleteMany: jest.fn().mockResolvedValue({ count: 4 }),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const inapp = { removeBySubject: jest.fn() };
    const events = { publish: jest.fn() };
    const summary = { sendFor: jest.fn() };
    const service = new SupportSweepService(prisma as never, inapp as never, events as never, summary as never);
    return { service, prisma, tx, created, inapp, events, summary };
  }

  it('closes what has gone a day without a message, and deletes everything a week after its last one', async () => {
    const { service, prisma, created, inapp, events, summary } = sweepSetup([
      { id: 'c-team', handedOffAt: hoursAgo(30) },
      { id: 'c-ai', handedOffAt: null },
    ]);
    expect(await service.sweep(now)).toEqual({ closed: 2, deleted: 4 });

    expect(prisma.supportConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: 'CLOSED' }, lastMessageAt: { lt: hoursAgo(IDLE_CLOSE_HOURS) }, messages: { some: {} } },
      }),
    );
    expect(created.map((m) => [m.conversationId, m.role, m.body])).toEqual([
      ['c-team', 'SYSTEM', AUTO_CLOSED],
      ['c-ai', 'SYSTEM', AUTO_CLOSED],
    ]);
    expect(events.publish).toHaveBeenCalledWith('c-ai', 'status', { status: 'CLOSED' });
    // Only the one the team handled clears the admins' prompt and is summarised by email.
    expect(inapp.removeBySubject).toHaveBeenCalledWith('support:c-team');
    expect(summary.sendFor).toHaveBeenCalledTimes(1);
    expect(summary.sendFor).toHaveBeenCalledWith('c-team');

    expect(prisma.supportConversation.deleteMany).toHaveBeenCalledWith({
      where: { lastMessageAt: { lt: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    });
  });

  it('leaves one that got a message or was closed since it was read', async () => {
    const { service, created, summary } = sweepSetup([{ id: 'c1', handedOffAt: hoursAgo(30) }], false);
    expect(await service.sweep(now)).toEqual({ closed: 0, deleted: 4 });
    expect(created).toEqual([]);
    expect(summary.sendFor).not.toHaveBeenCalled();
  });
});
