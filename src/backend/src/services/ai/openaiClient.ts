import OpenAI from 'openai';

const CHAT_MODEL_FALLBACK = 'gpt-5-mini';

const isNonChatModel = (model: string): boolean => {
  const normalized = model.toLowerCase().trim();
  return (
    normalized.startsWith('text-') ||
    normalized.includes('instruct') ||
    ['ada', 'babbage', 'curie', 'davinci'].includes(normalized)
  );
};

const ensureChatModel = (model: string | undefined): string => {
  if (!model) return CHAT_MODEL_FALLBACK;
  return isNonChatModel(model) ? CHAT_MODEL_FALLBACK : model;
};

export const getOpenAIModel = (): string => {
  // Default "general" model: prefer the fast model for latency-sensitive UX.
  return ensureChatModel(process.env.OPENAI_MODEL || process.env.OPENAI_FAST_MODEL || CHAT_MODEL_FALLBACK);
};

export const getSmartModel = (): string => {
  // Default "smart" model: prioritize best coding/agentic performance.
  return ensureChatModel(process.env.OPENAI_SMART_MODEL || process.env.OPENAI_MODEL || 'gpt-5.2-codex');
};

export const getFastModel = (): string => {
  // Default "fast" model: low latency while still being strong for code assistance.
  return ensureChatModel(process.env.OPENAI_FAST_MODEL || process.env.OPENAI_MODEL || CHAT_MODEL_FALLBACK);
};

export const getEmbeddingModel = (): string => {
  return process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
};

export const getOpenAIClient = (apiKey?: string): OpenAI => {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI API key is required');
  }
  const timeout = Number(process.env.OPENAI_TIMEOUT_MS || 120_000);
  return new OpenAI({
    apiKey: key,
    timeout: Number.isFinite(timeout) ? timeout : 120_000
  });
};

export const extractJson = (raw: string): Record<string, any> | null => {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const sliced = raw.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(sliced);
      } catch {
        return null;
      }
    }
    return null;
  }
};
