import { APICallError, simulateReadableStream, streamText, type LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import type { ChainLink } from './links';
import { BROKEN_COOLDOWN_S, errorStatus, runChain, type CooldownStore } from './run';

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function answering(text: string, chunkDelayInMs = 0) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunkDelayInMs,
        chunks: [
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: text },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage },
        ],
      }),
    }),
  });
}

function failing(statusCode: number, headers: Record<string, string> = {}) {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new APICallError({
        message: `HTTP ${statusCode}`,
        url: 'https://example.test',
        requestBodyValues: {},
        statusCode,
        responseHeaders: headers,
        isRetryable: statusCode === 429 || statusCode >= 500,
      });
    },
  });
}

const link = (id: string, model: LanguageModel): ChainLink => ({
  provider: id.split(':')[0] as ChainLink['provider'],
  modelId: id.split(':')[1],
  id,
  model,
});

function cooldowns(cooling: string[] = []) {
  const store = {
    cooled: new Map<string, number>(),
    quota: [] as string[],
    isCooling: jest.fn(async (id: string) => cooling.includes(id)),
    cool: jest.fn(async (id: string, seconds: number) => void store.cooled.set(id, seconds)),
    quotaHit: jest.fn(async (provider: string) => void store.quota.push(provider)),
  };
  return store as typeof store & CooldownStore;
}

const start = (chain: ChainLink, abortSignal: AbortSignal) =>
  streamText({ model: chain.model, prompt: 'Hi', maxRetries: 0, abortSignal, onError: () => undefined });

async function textOf(stream: ReadableStream<{ type: string; text?: string }>) {
  let text = '';
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text;
    if (value.type === 'text-delta') text += value.text;
  }
}

describe('runChain', () => {
  it('answers with the first link when it works', async () => {
    const store = cooldowns();
    const { success, failures } = await runChain({ links: [link('google:a', answering('Hello')), link('groq:b', answering('No'))], cooldowns: store, start });
    expect(success?.link.id).toBe('google:a');
    expect(await textOf(success!.stream)).toBe('Hello');
    expect(failures).toEqual([]);
  });

  it('skips a link that is cooling down', async () => {
    const first = answering('First');
    const store = cooldowns(['google:a']);
    const { success } = await runChain({ links: [link('google:a', first), link('groq:b', answering('Second'))], cooldowns: store, start });
    expect(success?.link.id).toBe('groq:b');
    expect(await textOf(success!.stream)).toBe('Second');
    expect(first.doStreamCalls).toHaveLength(0);
  });

  it('cools a link down on a 429 (for its retry-after), counts the quota hit and falls through', async () => {
    const store = cooldowns();
    const { success, failures } = await runChain({
      links: [link('google:a', failing(429, { 'retry-after': '30' })), link('cerebras:c', answering('Fine'))],
      cooldowns: store,
      start,
    });
    expect(success?.link.id).toBe('cerebras:c');
    expect(failures).toEqual([{ linkId: 'google:a', reason: 'rate_limited', status: 429 }]);
    expect(store.cooled.get('google:a')).toBe(30);
    expect(store.quota).toEqual(['google']);
  });

  it('cools a 5xx for 60 seconds, and a refused link (a bad key) for longer', async () => {
    const store = cooldowns();
    const { success, failures } = await runChain({
      links: [link('google:a', failing(503)), link('groq:b', failing(401)), link('cloudflare:c', answering('Ok'))],
      cooldowns: store,
      start,
    });
    expect(success?.link.id).toBe('cloudflare:c');
    expect(failures.map((f) => f.reason)).toEqual(['server_error', 'refused']);
    expect(store.cooled.get('google:a')).toBe(60);
    expect(store.cooled.get('groq:b')).toBe(BROKEN_COOLDOWN_S);
    expect(store.quota).toEqual([]);
  });

  it('gives up on a link with no content before the first-chunk timeout', async () => {
    const store = cooldowns();
    const { success, failures } = await runChain({
      links: [link('google:slow', answering('Late', 200)), link('groq:b', answering('Quick'))],
      cooldowns: store,
      start,
      firstChunkMs: 50,
    });
    expect(success?.link.id).toBe('groq:b');
    expect(failures).toEqual([{ linkId: 'google:slow', reason: 'timeout' }]);
    expect(store.cooled.has('google:slow')).toBe(true);
  });

  it('returns nothing when every link is down or cooling (the busy reply)', async () => {
    const store = cooldowns(['groq:b']);
    const { success, failures } = await runChain({
      links: [link('google:a', failing(429)), link('groq:b', answering('x'))],
      cooldowns: store,
      start,
    });
    expect(success).toBeNull();
    expect(failures).toHaveLength(1);
    expect((await runChain({ links: [], cooldowns: store, start })).success).toBeNull();
  });

  it('reads the status through a RetryError', () => {
    expect(errorStatus({ lastError: { statusCode: 429, responseHeaders: { 'retry-after': '12' } } })).toEqual({
      status: 429,
      retryAfter: 12,
    });
    expect(errorStatus(new Error('socket hang up'))).toEqual({});
  });
});
