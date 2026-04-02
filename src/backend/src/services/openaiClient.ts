/**
 * Shared AI Client Singletons (OpenAI + Anthropic)
 *
 * All backend code that needs AI APIs should import from here
 * instead of creating individual instances. This ensures:
 * - Single connection pool per provider
 * - Consistent configuration
 * - Centralized API key management
 * - Easy to swap models or add middleware
 *
 * Updated April 2026 for OpenAI SDK 6.33+ and Anthropic SDK
 */
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';

// --- OpenAI ---
const openaiApiKey = process.env.OPENAI_API_KEY || '';
if (!openaiApiKey) {
  logger.warn('OPENAI_API_KEY not set — OpenAI calls will fail');
}

export const openai = new OpenAI({
  apiKey: openaiApiKey,
  maxRetries: 2,
});

// --- Anthropic ---
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
let anthropicClient: Anthropic | null = null;

if (anthropicApiKey) {
  anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
  logger.info('Anthropic client initialized');
} else {
  logger.warn('ANTHROPIC_API_KEY not set — Claude calls will be skipped');
}

export const anthropic = anthropicClient;

/**
 * Default model constants — centralized so changes propagate everywhere.
 * Updated 2 April 2026: Claude 4.6 models, gpt-4o/gpt-4o-mini deprecated Feb 2026.
 */
export const MODELS = {
  // OpenAI models
  /** Best for code generation — 1M token context */
  CODE: process.env.OPENAI_SCRIPT_MODEL || 'gpt-4.1',
  /** Flagship model for complex multi-step tasks */
  FLAGSHIP: 'gpt-5.4',
  /** Fast model for simple tasks */
  FAST: 'gpt-4.1-mini',
  /** Nano model — cheapest option */
  NANO: 'gpt-4.1-nano',
  /** Reasoning model for complex analysis */
  REASONING: 'o3',
  /** Lightweight reasoning */
  REASONING_FAST: 'o4-mini',
  /** Embedding model */
  EMBEDDING: 'text-embedding-3-large',
  /** TTS model */
  TTS: 'gpt-4o-mini-tts',
  /** STT model */
  STT: 'gpt-4o-mini-transcribe',

  // Anthropic Claude 4.6 models (February 2026)
  /** Claude Sonnet 4.6 — best balance of speed and quality */
  CLAUDE_SONNET: 'claude-sonnet-4-6-20260217',
  /** Claude Opus 4.6 — most capable, complex reasoning */
  CLAUDE_OPUS: 'claude-opus-4-6-20260205',
  /** Claude Haiku 4.5 — fast and cost-effective */
  CLAUDE_HAIKU: 'claude-haiku-4-5-20251001',
} as const;

export type AIProvider = 'openai' | 'anthropic';

/**
 * Infer the AI provider from a model ID string.
 * Claude models start with "claude-"; everything else is OpenAI.
 */
export function inferProvider(modelId: string): AIProvider {
  return modelId.startsWith('claude-') ? 'anthropic' : 'openai';
}

/**
 * Check whether the required provider client is available for a given model.
 */
export function isProviderAvailable(modelId: string): boolean {
  const provider = inferProvider(modelId);
  if (provider === 'anthropic') return anthropicClient !== null;
  return !!openaiApiKey;
}

export default openai;
