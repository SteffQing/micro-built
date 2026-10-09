import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from 'src/database/prisma.service';
import type { SupportCaller } from './caller';
import type { SupportLimits } from './limits';
import { NEW_CONVERSATION_TITLE, SupportService, titleFrom } from './support.service';

const customer = { audience: 'CUSTOMER', restricted: false, user: { userId: 'u1' }, visitorId: null, ip: null } as SupportCaller;
const visitor = { audience: 'ANONYMOUS', restricted: false, user: null, visitorId: 'v1', ip: '9.9.9.9' } as SupportCaller;

function setup() {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ name: 'Ada Obi' }), findMany: jest.fn().mockResolvedValue([]) },
    supportConversation: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'c1', ...data })),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    supportMessage: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const limits = {
    takeConversation: jest.fn(),
    remainingToday: jest.fn().mockResolvedValue(40),
  } as unknown as SupportLimits & { takeConversation: jest.Mock };
  const inapp = { markSubjectRead: jest.fn() };
  return { prisma, limits, inapp, service: new SupportService(prisma as unknown as PrismaService, limits, inapp as never, { scheduleClose: jest.fn() } as never) };
}

const fetchMock = jest.fn();
beforeEach(() => {
  process.env.SUPPORT_ENABLED = 'true';
  process.env.TURNSTILE_SECRET_KEY = 'secret';
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});
afterAll(() => {
  delete process.env.SUPPORT_ENABLED;
  delete process.env.TURNSTILE_SECRET_KEY;
});

describe('SupportService', () => {
  it("describes the caller's session", async () => {
    const { service } = setup();
    expect(await service.session(customer)).toMatchObject({
      enabled: true,
      audience: 'CUSTOMER',
      firstName: 'Ada',
      restricted: false,
      limits: { messageChars: 1000, remainingToday: 40 },
      turnstileRequired: false,
      canHandoff: true,
    });
    const visitorSession = await service.session(visitor);
    expect(visitorSession).toMatchObject({ audience: 'ANONYMOUS', turnstileRequired: true });
    expect(visitorSession.firstName).toBeUndefined();
    expect(visitorSession.suggestions.length).toBeGreaterThan(0);
  });

  it('says enabled: false when support is switched off', async () => {
    process.env.SUPPORT_ENABLED = 'false';
    const { service } = setup();
    expect((await service.session(customer)).enabled).toBe(false);
  });

  it('needs a Turnstile pass for a visitor, not for a signed-in user', async () => {
    const { prisma, limits, service } = setup();
    await expect(service.create(visitor)).rejects.toThrow(BadRequestException);
    expect(prisma.supportConversation.create).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: false }) });
    await expect(service.create(visitor, 'bad')).rejects.toThrow("couldn't confirm you are human");

    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: true }) });
    await service.create(visitor, 'good');
    const body = fetchMock.mock.calls[1][1].body as URLSearchParams;
    expect(body.get('response')).toBe('good');
    expect(body.get('remoteip')).toBe('9.9.9.9');
    expect(limits.takeConversation).toHaveBeenCalledWith(visitor);
    expect(prisma.supportConversation.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { visitorId: 'v1', audience: 'ANONYMOUS', title: NEW_CONVERSATION_TITLE } }),
    );

    await service.create(customer);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(prisma.supportConversation.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { userId: 'u1', audience: 'CUSTOMER', title: NEW_CONVERSATION_TITLE } }),
    );
  });

  it("answers someone else's conversation as not found", async () => {
    const { prisma, service } = setup();
    await expect(service.thread(customer, 'c-visitor')).rejects.toThrow(NotFoundException);
    expect(prisma.supportConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c-visitor', userId: 'u1' } }),
    );
    await expect(service.thread(visitor, 'c-user')).rejects.toThrow(NotFoundException);
    expect(prisma.supportConversation.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: 'c-user', visitorId: 'v1' } }),
    );
    expect(prisma.supportMessage.findMany).not.toHaveBeenCalled();
  });

  it('marks the notification about the replies read when the requester opens the conversation', async () => {
    const { prisma, inapp, service } = setup();
    prisma.supportConversation.findFirst.mockResolvedValue({ id: 'c1', title: 'June', status: 'ASSIGNED', requesterUnread: true });
    await service.thread(customer, 'c1');
    expect(inapp.markSubjectRead).toHaveBeenCalledWith('u1', 'support-reply:c1');
    expect(prisma.supportConversation.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { requesterUnread: false } });
  });

  it("lists only the caller's conversations that have messages", async () => {
    const { prisma, service } = setup();
    prisma.supportConversation.findMany.mockResolvedValueOnce([
      { id: 'c1', title: 'Hi', status: 'AI', lastMessageAt: new Date(), requesterUnread: true },
    ]);
    prisma.supportConversation.count.mockResolvedValueOnce(1);
    const { data, meta } = await service.list(visitor);
    expect(data).toEqual([expect.objectContaining({ id: 'c1', unread: true })]);
    expect(data[0]).not.toHaveProperty('requesterUnread');
    expect(meta).toEqual({ total: 1, page: 1, limit: 20 });
    expect(prisma.supportConversation.findMany.mock.calls[0][0].where).toEqual({ visitorId: 'v1', messages: { some: {} } });
  });

  it("rates only an assistant reply in the caller's own conversation", async () => {
    const { prisma, service } = setup();
    await expect(service.rate(customer, 'm1', 'UP')).rejects.toThrow(NotFoundException);
    expect(prisma.supportMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 'm1', role: 'AI', conversation: { userId: 'u1' } },
      data: { rating: 'UP' },
    });
    prisma.supportMessage.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(service.rate(customer, 'm1', 'DOWN')).resolves.toEqual({ id: 'm1', rating: 'DOWN' });
  });

  it('titles a conversation with its first message, cut to 60 characters', () => {
    expect(titleFrom("  What's   my\nbalance? ")).toBe("What's my balance?");
    const long = titleFrom('a'.repeat(100));
    expect(long).toHaveLength(60);
    expect(long.endsWith('…')).toBe(true);
  });
});
