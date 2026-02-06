import OpenAI from 'openai';

const CHAT_MODEL_FALLBACK = 'gpt-5-mini';

// GPT-5 + Codex family models are Responses-first and may not support the legacy
// Chat Completions endpoint. Route them to Responses API automatically.
const shouldUseResponsesApi = (model: string | undefined): boolean => {
  if (!model) return false;
  const normalized = model.toLowerCase().trim();
  return normalized.includes('codex') || normalized.startsWith('gpt-5');
};

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
  const client = new OpenAI({
    apiKey: key,
    timeout: Number.isFinite(timeout) ? timeout : 120_000
  });

  // Patch chat.completions.create so existing code can keep using the Chat
  // Completions SDK surface, while GPT-5/Codex requests transparently go through
  // the Responses API (which supports these models).
  const originalCreate = (client as any)?.chat?.completions?.create?.bind((client as any).chat.completions);
  if (typeof originalCreate === 'function') {
    (client as any).chat.completions.create = async (params: any, options?: any) => {
      const model = params?.model;
      if (!shouldUseResponsesApi(model)) {
        return originalCreate(params, options);
      }

      const response = await (client as any).responses.create(
        {
          model,
          input: params?.messages,
          // Map JSON mode request shape.
          ...(params?.response_format?.type === 'json_object'
            ? { text: { format: { type: 'json_object' } } }
            : undefined),
          // Best-effort mappings for common fields.
          ...(typeof params?.max_tokens === 'number' ? { max_output_tokens: params.max_tokens } : undefined),
          ...(typeof params?.temperature === 'number' ? { temperature: params.temperature } : undefined),
          ...(typeof params?.top_p === 'number' ? { top_p: params.top_p } : undefined),
          ...(Array.isArray(params?.stop) ? { stop: params.stop } : undefined),
          ...(typeof params?.stop === 'string' ? { stop: [params.stop] } : undefined),
          ...(typeof params?.presence_penalty === 'number' ? { presence_penalty: params.presence_penalty } : undefined),
          ...(typeof params?.frequency_penalty === 'number' ? { frequency_penalty: params.frequency_penalty } : undefined),
          ...(typeof params?.seed === 'number' ? { seed: params.seed } : undefined),
          ...(typeof params?.user === 'string' ? { user: params.user } : undefined),
        },
        options
      );

      const outputText = response?.output_text ?? '';
      return {
        id: response?.id,
        model: response?.model ?? model,
        created: Math.floor(Date.now() / 1000),
        usage: response?.usage,
        choices: [
          {
            index: 0,
            finish_reason: response?.status === 'completed' ? 'stop' : 'length',
            message: { role: 'assistant', content: outputText },
          },
        ],
      };
    };
  }

  return client;
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
