import type { TextStreamPart, ToolSet } from 'ai';
import type { ChainLink, ProviderName } from './links';

// Runs the chain (CHAT_SUPPORT.md §1.2 step 5): links are tried in order, skipping any that is cooling down. A link that
// fails before its first content (429, 5xx, or no content within FIRST_CHUNK_MS) cools down and the next is tried; once
// a link has produced content, the reply is its, whatever happens after.

export const FIRST_CHUNK_MS = 8_000;
export const DEFAULT_COOLDOWN_S = 60;
/** A link refused for another reason (a bad key, a model that no longer exists) is left alone for longer. */
export const BROKEN_COOLDOWN_S = 5 * 60;

export interface CooldownStore {
  isCooling(linkId: string): Promise<boolean>;
  cool(linkId: string, seconds: number): Promise<void>;
  /** A 429: counted per provider and day for the analytics. */
  quotaHit(provider: ProviderName): Promise<void>;
}

export interface LinkStart<TOOLS extends ToolSet> {
  stream: ReadableStream<TextStreamPart<TOOLS>>;
}

export interface ChainFailure {
  linkId: string;
  reason: 'rate_limited' | 'server_error' | 'timeout' | 'refused' | 'empty';
  status?: number;
}

export interface ChainSuccess<TOOLS extends ToolSet> {
  link: ChainLink;
  /** The link's stream from the start: the parts read while waiting for content are replayed first. */
  stream: ReadableStream<TextStreamPart<TOOLS>>;
}

/** Parts that show the model is answering: text, or a tool call on its way. */
const CONTENT = new Set(['text-delta', 'reasoning-delta', 'tool-input-start', 'tool-call']);

interface ErrorLike {
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  lastError?: unknown;
  cause?: unknown;
}

/** The HTTP status and retry-after of a provider error (an APICallError, possibly wrapped in a RetryError). */
export function errorStatus(error: unknown): { status?: number; retryAfter?: number } {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const e = current as ErrorLike;
    if (typeof e.statusCode === 'number') {
      const header = e.responseHeaders?.['retry-after'] ?? e.responseHeaders?.['Retry-After'];
      const seconds = header ? Number(header) : NaN;
      return { status: e.statusCode, ...(Number.isFinite(seconds) && seconds > 0 && { retryAfter: seconds }) };
    }
    current = e.lastError ?? e.cause;
  }
  return {};
}

type FirstRead =
  | { kind: 'content' }
  | { kind: 'error'; error: unknown }
  | { kind: 'empty' }
  | { kind: 'timeout' };

async function readUntilContent<TOOLS extends ToolSet>(
  reader: ReadableStreamDefaultReader<TextStreamPart<TOOLS>>,
  buffered: TextStreamPart<TOOLS>[],
  timeoutMs: number,
): Promise<FirstRead> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<FirstRead>((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs);
  });
  const read = (async (): Promise<FirstRead> => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return { kind: 'empty' };
      if (value.type === 'error') return { kind: 'error', error: value.error };
      buffered.push(value);
      if (CONTENT.has(value.type) && !(value.type === 'text-delta' && !value.text)) return { kind: 'content' };
      if (value.type === 'finish') return { kind: 'empty' };
    }
  })();
  try {
    return await Promise.race([read, timeout]);
  } catch (error) {
    return { kind: 'error', error };
  } finally {
    clearTimeout(timer);
  }
}

function replay<TOOLS extends ToolSet>(
  buffered: TextStreamPart<TOOLS>[],
  reader: ReadableStreamDefaultReader<TextStreamPart<TOOLS>>,
): ReadableStream<TextStreamPart<TOOLS>> {
  return new ReadableStream<TextStreamPart<TOOLS>>({
    start(controller) {
      for (const part of buffered) controller.enqueue(part);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

/**
 * Tries each link in turn. `start` begins the link's call (with an abort signal this function aborts when it gives up
 * on the link). Returns the first link that produced content, or null when every link failed or is cooling down.
 */
export async function runChain<TOOLS extends ToolSet>({
  links,
  cooldowns,
  start,
  firstChunkMs = FIRST_CHUNK_MS,
}: {
  links: ChainLink[];
  cooldowns: CooldownStore;
  start: (link: ChainLink, abortSignal: AbortSignal) => LinkStart<TOOLS>;
  firstChunkMs?: number;
}): Promise<{ success: ChainSuccess<TOOLS> | null; failures: ChainFailure[] }> {
  const failures: ChainFailure[] = [];
  for (const link of links) {
    if (await cooldowns.isCooling(link.id)) continue;
    const abort = new AbortController();
    let reader: ReadableStreamDefaultReader<TextStreamPart<TOOLS>>;
    const buffered: TextStreamPart<TOOLS>[] = [];
    let first: FirstRead;
    try {
      reader = start(link, abort.signal).stream.getReader();
      first = await readUntilContent(reader, buffered, firstChunkMs);
    } catch (error) {
      first = { kind: 'error', error };
    }
    if (first.kind === 'content') {
      return { success: { link, stream: replay(buffered, reader!) }, failures };
    }

    abort.abort();
    let failure: ChainFailure;
    if (first.kind === 'timeout') {
      failure = { linkId: link.id, reason: 'timeout' };
      await cooldowns.cool(link.id, DEFAULT_COOLDOWN_S);
    } else if (first.kind === 'empty') {
      failure = { linkId: link.id, reason: 'empty' };
    } else {
      const { status, retryAfter } = errorStatus(first.error);
      if (status === 429) {
        failure = { linkId: link.id, reason: 'rate_limited', status };
        await cooldowns.cool(link.id, retryAfter ?? DEFAULT_COOLDOWN_S);
        await cooldowns.quotaHit(link.provider);
      } else if (status === undefined || status >= 500) {
        // No status: the connection itself failed, which is the provider's side too.
        failure = { linkId: link.id, reason: 'server_error', ...(status !== undefined && { status }) };
        await cooldowns.cool(link.id, retryAfter ?? DEFAULT_COOLDOWN_S);
      } else {
        failure = { linkId: link.id, reason: 'refused', status };
        await cooldowns.cool(link.id, BROKEN_COOLDOWN_S);
      }
    }
    failures.push(failure);
  }
  return { success: null, failures };
}
