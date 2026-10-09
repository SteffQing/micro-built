import { createCerebras } from '@ai-sdk/cerebras';
import { createGoogle } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';

// The reply models (CHAT_SUPPORT.md C2): SUPPORT_CHAIN lists `provider:model` links in order. A link is used only when
// its provider's key is set, so the chain is configured by env alone when free models change.

export const PROVIDERS = ['google', 'groq', 'cerebras', 'cloudflare'] as const;
export type ProviderName = (typeof PROVIDERS)[number];

/**
 * How hard a link's model thinks. Short replies need the least each allows, or thinking eats the token cap (Gemini 3.x
 * cut replies short). Providers differ: Cerebras and Groq's gpt-oss refuse `minimal` ("unsupported reasoning_effort")
 * and take `low`; Workers AI's Llama doesn't think, so nothing is sent.
 */
export const REASONING: Record<ProviderName, 'minimal' | 'low' | undefined> = {
  google: 'minimal',
  groq: 'low',
  cerebras: 'low',
  cloudflare: undefined,
};

/** The reasoning option for a link's call, or none. */
export const reasoningFor = (link: Pick<ChainLink, 'provider'>) =>
  REASONING[link.provider] ? { reasoning: REASONING[link.provider] } : {};

export interface ChainLink {
  provider: ProviderName;
  modelId: string;
  /** `provider:model`: the cooldown key, and what is stored on the AI message. */
  id: string;
  model: LanguageModel;
}

type Env = Record<string, string | undefined>;
type Factory = (env: Env) => ((modelId: string) => LanguageModel) | null;
export type ProviderFactories = Record<ProviderName, Factory>;

/**
 * The providers' factories. workers-ai-provider ships only an `import` export (no `require`), so it is loaded with a
 * native dynamic import at boot.
 */
export async function loadFactories(): Promise<ProviderFactories> {
  const { createWorkersAI } = await import('workers-ai-provider');
  return {
    ...FACTORIES,
    cloudflare: (env) => {
      const accountId = env.CLOUDFLARE_ACCOUNT_ID;
      const apiKey = env.CLOUDFLARE_AI_TOKEN;
      if (!accountId || !apiKey) return null;
      const workersai = createWorkersAI({ accountId, apiKey });
      return (modelId) => workersai(modelId as Parameters<typeof workersai>[0]);
    },
  };
}

const FACTORIES: ProviderFactories = {
  google: (env) => {
    const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
    return apiKey ? createGoogle({ apiKey }) : null;
  },
  groq: (env) => {
    const apiKey = env.GROQ_API_KEY;
    return apiKey ? createGroq({ apiKey }) : null;
  },
  cerebras: (env) => {
    const apiKey = env.CEREBRAS_API_KEY;
    return apiKey ? createCerebras({ apiKey }) : null;
  },
  // Replaced by loadFactories() once workers-ai-provider is loaded.
  cloudflare: () => null,
};

const isProvider = (value: string): value is ProviderName => (PROVIDERS as readonly string[]).includes(value);

export interface ParsedChain {
  links: ChainLink[];
  /** Links left out, and why: logged once at boot. */
  skipped: string[];
}

export function parseChain(
  spec = process.env.SUPPORT_CHAIN ?? '',
  env: Env = process.env,
  factories: ProviderFactories = FACTORIES,
): ParsedChain {
  const links: ChainLink[] = [];
  const skipped: string[] = [];
  const providers = new Map<ProviderName, ((modelId: string) => LanguageModel) | null>();
  for (const raw of spec.split(',').map((item) => item.trim()).filter(Boolean)) {
    const at = raw.indexOf(':');
    const provider = raw.slice(0, at);
    const modelId = raw.slice(at + 1).trim();
    if (at < 1 || !modelId || !isProvider(provider)) {
      skipped.push(`${raw} (not provider:model with a known provider)`);
      continue;
    }
    if (!providers.has(provider)) providers.set(provider, factories[provider](env));
    const create = providers.get(provider);
    if (!create) {
      skipped.push(`${raw} (no key for ${provider})`);
      continue;
    }
    const id = `${provider}:${modelId}`;
    if (links.some((link) => link.id === id)) continue;
    links.push({ provider, modelId, id, model: create(modelId) });
  }
  return { links, skipped };
}
