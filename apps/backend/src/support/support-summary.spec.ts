jest.mock('src/notifications/mail.service', () => ({ MailService: class {} }));

import { Logger } from '@nestjs/common';
import { MockLanguageModelV4 } from 'ai/test';
import type { ChainLink } from './chain/links';
import { SupportSummaryService, plainText } from './support-summary.service';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

const noteModel = (text: string) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    }),
  });

function setup(conversation: Record<string, unknown> = {}, model?: MockLanguageModelV4) {
  const row = {
    title: 'My June deduction',
    userId: 'u1',
    assigneeId: 'a1',
    contactName: null,
    contactEmail: null,
    user: { name: 'Ada Obi', email: 'ada@example.com' },
    assignee: { name: 'Tunde Bello', email: 'tunde@microbuilt.test' },
    // Newest first, as the query reads them.
    messages: [
      { role: 'SYSTEM', body: 'Tunde closed the chat', authorId: null },
      { role: 'STAFF', body: 'Fixed, it was double counted.', authorId: 'a1' },
      { role: 'AI', body: 'See **your repayments** [here](/repayments).', authorId: null },
      { role: 'USER', body: 'June looks wrong', authorId: null },
    ],
    ...conversation,
  };
  const prisma = {
    supportConversation: { findUnique: jest.fn().mockResolvedValue(row) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'a1', name: 'Tunde Bello' }]) },
  };
  const links: ChainLink[] = model ? [{ provider: 'google', modelId: 'm', id: 'google:m', model }] : [];
  const chain = { links, isCooling: jest.fn().mockResolvedValue(false), cool: jest.fn(), quotaHit: jest.fn() };
  const mail = { sendSupportSummary: jest.fn().mockResolvedValue(undefined) };
  const service = new SupportSummaryService(prisma as never, chain as never, mail as never);
  return { service, mail };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

describe('SupportSummaryService', () => {
  it('emails both sides the conversation, each as "You", with the closing note', async () => {
    const { service, mail } = setup({}, noteModel('Resolved: the June deduction was corrected. Nothing left to do.'));
    await service.sendFor('c1');
    expect(mail.sendSupportSummary).toHaveBeenCalledTimes(2);
    const [[toRequester, requester], [toStaff, staff]] = mail.sendSupportSummary.mock.calls;
    expect(toRequester).toBe('ada@example.com');
    expect(requester).toMatchObject({ name: 'Ada', audience: 'requester', note: expect.stringMatching(/^Resolved/) });
    expect(requester.url).toMatch(/\/dashboard\?support=c1$/);
    expect(requester.transcript).toEqual([
      { speaker: 'You', body: 'June looks wrong' },
      { speaker: 'Prime', body: expect.stringMatching(/^See your repayments here \(https?:\/\/.+\/repayments\)\.$/) },
      { speaker: 'Tunde', body: 'Fixed, it was double counted.' },
      { body: 'Tunde closed the chat' },
    ]);
    expect(toStaff).toBe('tunde@microbuilt.test');
    expect(staff.url).toMatch(/\/support-inbox\/c1$/);
    expect(staff.transcript.map((line: { speaker?: string }) => line.speaker)).toEqual(['Ada', 'Prime', 'You', undefined]);
  });

  it('goes without the note when no model answers, and only to whoever has an address', async () => {
    const { service, mail } = setup({
      userId: null,
      user: null,
      contactName: 'Bola',
      contactEmail: 'bola@example.com',
      assigneeId: null,
      assignee: null,
    });
    await service.sendFor('c1');
    expect(mail.sendSupportSummary).toHaveBeenCalledTimes(1);
    expect(mail.sendSupportSummary.mock.calls[0][1]).toMatchObject({ name: 'Bola', note: undefined });
    expect(mail.sendSupportSummary.mock.calls[0][1].url).toMatch(/\/support\?c=c1$/);
  });

  it('sends nothing for a conversation nobody wrote in', async () => {
    const { service, mail } = setup({ messages: [] });
    await service.sendFor('c1');
    expect(mail.sendSupportSummary).not.toHaveBeenCalled();
  });

  it('turns markdown into plain text', () => {
    expect(plainText('**Bold** and `code`\n- one\n## Head')).toBe('Bold and code\n• one\nHead');
  });
});
