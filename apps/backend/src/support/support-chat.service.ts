import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import {
  createUIMessageStream,
  isStepCount,
  pipeUIMessageStreamToResponse,
  streamText,
  toUIMessageStream,
  type ModelMessage,
  type TextStreamPart,
  type ToolSet,
  type UIMessageChunk,
} from 'ai';
import type { Response } from 'express';
import { PrismaService } from 'src/database/prisma.service';
import { canHandoff, type SupportCaller } from './caller';
import { canned, type CannedReply } from './canned';
import { SupportChainService } from './chain/chain.service';
import { reasoningFor, type ChainLink } from './chain/links';
import { runChain } from './chain/run';
import { SupportGuardService } from './guard/guard.service';
import { guardActions, type GuardTurn, type GuardVerdict } from './guard/questions';
import { SupportLimits } from './limits';
import { buildPrompt } from './prompt';
import { scrub } from './scrub';
import { SupportEventsService } from './support-events.service';
import { SupportHandoffService } from './support-handoff.service';
import { SUPPORT_LIMITS, type SendSupportMessageDto, type SupportMessageDto } from './support.dto';
import { NEW_CONVERSATION_TITLE, PUBLIC_MESSAGE, SupportService, firstName, titleFrom } from './support.service';
import { SupportToolsService } from './tools';

export const FAILED_SENTENCE = 'Something went wrong. Please try again.';
/** The custom data part that closes every reply: the server's id for it (to rate it) and whether to offer the team. */
export const REPLY_DATA_PART = 'data-support';

export interface ReplyData {
  messageId: string;
  offerHandoff: boolean;
}

/** What the client sees of a tool call: its name (for "Checking your loan…"), never its input or output. */
export function hideToolDetails(chunk: UIMessageChunk): UIMessageChunk | null {
  switch (chunk.type) {
    case 'tool-input-delta':
      return null;
    case 'tool-input-available':
      return { ...chunk, input: {} };
    case 'tool-input-error':
      return { ...chunk, input: {}, errorText: 'Lookup failed' };
    case 'tool-output-available':
      return { ...chunk, output: null };
    case 'tool-output-error':
      return { ...chunk, errorText: 'Lookup failed' };
    default:
      return chunk;
  }
}

interface Collected {
  text: string;
  toolNames: Set<string>;
  inputTokens?: number;
  outputTokens?: number;
  failed: boolean;
}

/**
 * Watches the reply as it streams: the text (for the stored message), the tools called (names only) and the usage. A
 * provider error after the reply has started ends it with FAILED_SENTENCE (and goes to Sentry) instead of an error the
 * client would show as broken.
 */
function collect<TOOLS extends ToolSet>(collected: Collected, onFailure: (error: unknown) => void) {
  return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
    transform(part, controller) {
      switch (part.type) {
        case 'text-delta':
          collected.text += part.text;
          break;
        case 'tool-call':
          collected.toolNames.add(part.toolName);
          break;
        case 'finish':
          collected.inputTokens = part.totalUsage.inputTokens;
          collected.outputTokens = part.totalUsage.outputTokens;
          break;
        case 'error': {
          collected.failed = true;
          onFailure(part.error);
          const id = 'mb-failed';
          const text = `${collected.text ? '\n\n' : ''}${FAILED_SENTENCE}`;
          collected.text += text;
          controller.enqueue({ type: 'text-start', id } as TextStreamPart<TOOLS>);
          controller.enqueue({ type: 'text-delta', id, text } as TextStreamPart<TOOLS>);
          controller.enqueue({ type: 'text-end', id } as TextStreamPart<TOOLS>);
          controller.terminate();
          return;
        }
      }
      controller.enqueue(part);
    },
  });
}

type Conversation = Awaited<ReturnType<SupportService['owned']>>;

/** An AI message as its requester sees it (it has no author). */
const AI_MESSAGE = {
  id: true,
  role: true,
  body: true,
  rating: true,
  offerHandoff: true,
  createdAt: true,
} satisfies Prisma.SupportMessageSelect;

// The per-message pipeline (CHAT_SUPPORT.md §1.2): ownership and state, limits, the guard, a canned reply or the chain,
// then the AI message is stored and the reply streamed as the AI SDK's UI message stream.
@Injectable()
export class SupportChatService {
  private readonly logger = new Logger(SupportChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly support: SupportService,
    private readonly limits: SupportLimits,
    private readonly guard: SupportGuardService,
    private readonly chain: SupportChainService,
    private readonly tools: SupportToolsService,
    private readonly events: SupportEventsService,
    private readonly handoff: SupportHandoffService,
  ) {}

  /**
   * Answers on `response` itself: JSON when the conversation is with the team, otherwise the stream. Anything thrown
   * before the stream starts (404, 409, 429) is an ordinary error response.
   */
  async send(caller: SupportCaller, conversationId: string, dto: SendSupportMessageDto, response: Response): Promise<void> {
    const conversation = await this.support.owned(caller, conversationId);
    if (conversation.status === 'CLOSED') {
      throw new ConflictException('This conversation is closed. Start a new one to keep going.');
    }
    if (conversation.status === 'HANDOFF' || conversation.status === 'ASSIGNED') {
      // With the team: the assistant stays silent; the message goes to the thread and whoever answers it.
      const [message] = await this.support.toMessages([await this.storeUser(conversation, dto.text, { staffUnread: true })]);
      await this.events.publish(conversationId, 'message', { messageId: message.id });
      // Never throws; the requester doesn't wait for the team to be told.
      void this.handoff.nudge(conversationId);
      response.status(200).json({ data: message, message: 'Sent to the team' });
      return;
    }

    await this.limits.takeMessage(caller);
    const history = await this.history(conversationId);
    await this.storeUser(conversation, dto.text);

    const verdict = await this.guard.check({ audience: caller.audience, message: dto.text, recentTurns: history.slice(-2) });
    const action = guardActions(verdict, caller.audience);
    const handoffAllowed = canHandoff(caller);
    const offerHandoff = handoffAllowed && action.offerHandoff;
    await this.prisma.supportConversation.update({ where: { id: conversationId }, data: { topic: verdict.topic } });

    if (action.canned) {
      const reply = canned(action.canned, dto.text, handoffAllowed);
      return this.streamCanned(response, conversationId, { ...reply, offerHandoff: reply.offerHandoff || offerHandoff }, verdict);
    }

    const tools = this.tools.toolsFor(caller, verdict.topic);
    const name = caller.user
      ? (await this.prisma.user.findUnique({ where: { id: caller.user.userId }, select: { name: true } }))?.name
      : undefined;
    const instructions = buildPrompt({
      audience: caller.audience,
      restricted: caller.restricted,
      firstName: firstName(name),
      canHandoff: handoffAllowed,
      hasTools: Object.keys(tools).length > 0,
    });
    const messages: ModelMessage[] = [
      ...history.map((turn): ModelMessage => ({ role: turn.role, content: turn.text })),
      { role: 'user', content: dto.text },
    ];

    // The reader going away (Stop, or closing the chat) stops the model too.
    const gone = new AbortController();
    response.on('close', () => gone.abort());

    const { success, failures } = await runChain({
      links: this.chain.links,
      cooldowns: this.chain,
      start: (link, abortSignal) =>
        streamText({
          model: link.model,
          instructions,
          messages,
          tools,
          stopWhen: isStepCount(SUPPORT_LIMITS.maxSteps),
          maxOutputTokens: SUPPORT_LIMITS.maxOutputTokens,
          // Thinking models (Gemini 3.x, gpt-oss) would spend the 600 tokens thinking and cut the reply short.
          ...reasoningFor(link),
          temperature: 0.3,
          maxRetries: 0,
          abortSignal: AbortSignal.any([abortSignal, gone.signal]),
          experimental_transform: scrub(),
          // Errors reach the stream as parts; runChain and collect() handle them.
          onError: () => undefined,
        }),
    });
    if (failures.length) {
      this.logger.warn(`Support chain fell through: ${failures.map((f) => `${f.linkId} ${f.reason}`).join(', ')}`);
    }
    if (!success) {
      const busy = canned('busy', dto.text, handoffAllowed);
      return this.streamCanned(response, conversationId, busy, verdict);
    }
    return this.streamReply(response, conversationId, success.link, success.stream, verdict, {
      offerHandoff,
      handoffAllowed,
    });
  }

  /** The turns the model gets as history: the last 12 messages of the thread, before this one. */
  private async history(conversationId: string): Promise<GuardTurn[]> {
    const rows = await this.prisma.supportMessage.findMany({
      where: { conversationId, role: { in: ['USER', 'AI', 'STAFF'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: SUPPORT_LIMITS.historyMessages - 1,
      select: { role: true, body: true },
    });
    return rows.reverse().map((row) => ({ role: row.role === 'USER' ? 'user' : 'assistant', text: row.body }));
  }

  private async storeUser(
    conversation: Conversation,
    text: string,
    extra: Prisma.SupportConversationUpdateInput = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.supportMessage.create({
        data: { conversationId: conversation.id, role: 'USER', body: text },
        select: PUBLIC_MESSAGE,
      });
      await tx.supportConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.createdAt,
          ...(conversation.title === NEW_CONVERSATION_TITLE && { title: titleFrom(text) }),
          ...extra,
        },
      });
      return message;
    });
  }

  private async storeAi(
    conversationId: string,
    data: Omit<Prisma.SupportMessageUncheckedCreateInput, 'conversationId' | 'role'>,
  ): Promise<SupportMessageDto> {
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.supportMessage.create({
        data: { ...data, conversationId, role: 'AI' },
        select: AI_MESSAGE,
      });
      await tx.supportConversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
      return message;
    });
  }

  private async streamCanned(response: Response, conversationId: string, reply: CannedReply, verdict: GuardVerdict) {
    const saved = await this.storeAi(conversationId, {
      body: reply.body,
      provider: 'canned',
      model: reply.kind,
      guard: verdict as unknown as Prisma.InputJsonValue,
      offerHandoff: reply.offerHandoff,
    });
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: 'start' });
        writer.write({ type: 'text-start', id: 'canned' });
        writer.write({ type: 'text-delta', id: 'canned', delta: reply.body });
        writer.write({ type: 'text-end', id: 'canned' });
        writer.write({ type: REPLY_DATA_PART, data: { messageId: saved.id, offerHandoff: reply.offerHandoff } satisfies ReplyData });
        writer.write({ type: 'finish' });
      },
    });
    void pipeUIMessageStreamToResponse({ response, stream });
  }

  private streamReply<TOOLS extends ToolSet>(
    response: Response,
    conversationId: string,
    link: ChainLink,
    source: ReadableStream<TextStreamPart<TOOLS>>,
    verdict: GuardVerdict,
    { offerHandoff, handoffAllowed }: { offerHandoff: boolean; handoffAllowed: boolean },
  ) {
    const collected: Collected = { text: '', toolNames: new Set(), failed: false };
    const watched = source.pipeThrough(
      collect<TOOLS>(collected, (error) => {
        this.logger.error(`Support reply from ${link.id} failed mid-stream: ${(error as Error)?.message ?? error}`);
        Sentry.captureException(error, { tags: { feature: 'support', link: link.id } });
      }),
    );
    const ui = toUIMessageStream({ stream: watched, sendFinish: false, sendReasoning: false, onError: () => FAILED_SENTENCE });

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const reader = ui.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const shown = hideToolDetails(value as UIMessageChunk);
            if (shown) writer.write(shown);
          }
        } catch (error) {
          // The reader went away (Stop): keep what was said.
          this.logger.debug(`Support reply stream ended early: ${(error as Error).message}`);
        }
        const body = collected.text.trim() || FAILED_SENTENCE;
        const saved = await this.storeAi(conversationId, {
          body,
          provider: link.provider,
          model: link.modelId,
          toolNames: [...collected.toolNames],
          guard: verdict as unknown as Prisma.InputJsonValue,
          // A reply that broke off offers the team, for those who can reach it.
          offerHandoff: offerHandoff || (collected.failed && handoffAllowed),
          inputTokens: collected.inputTokens ?? null,
          outputTokens: collected.outputTokens ?? null,
        });
        writer.write({
          type: REPLY_DATA_PART,
          data: { messageId: saved.id, offerHandoff: saved.offerHandoff } satisfies ReplyData,
        });
        writer.write({ type: 'finish' });
      },
      onError: (error) => {
        Sentry.captureException(error, { tags: { feature: 'support' } });
        return FAILED_SENTENCE;
      },
    });
    void pipeUIMessageStreamToResponse({ response, stream });
  }
}
