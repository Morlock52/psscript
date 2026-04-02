/**
 * Shared OpenAI Client Singleton
 *
 * All backend code that needs the OpenAI API should import from here
 * instead of creating individual instances. This ensures:
 * - Single connection pool
 * - Consistent configuration
 * - Centralized API key management
 * - Easy to swap models or add middleware
 *
 * Updated April 2026 for OpenAI SDK 6.33+
 */
import OpenAI from 'openai';
import logger from '../utils/logger';

const apiKey = process.env.OPENAI_API_KEY || '';

if (!apiKey) {
  logger.warn('OPENAI_API_KEY not set — OpenAI calls will fail');
}

/**
 * Shared OpenAI client instance.
 * Uses default timeout (10 min) and retry (2 retries) from SDK 6.x.
 */
export const openai = new OpenAI({
  apiKey,
  maxRetries: 2,
});

/**
 * Default model constants — centralized so changes propagate everywhere.
 * Updated April 2026: gpt-4o/gpt-4o-mini deprecated Feb 2026.
 */
export const MODELS = {
  /** Best for code generation — 1M token context */
  CODE: process.env.OPENAI_SCRIPT_MODEL || 'gpt-4.1',
  /** Flagship model for complex multi-step tasks */
  FLAGSHIP: 'gpt-5.4',
  /** Fast model for simple tasks */
  FAST: 'gpt-4.1-mini',
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
} as const;

export default openai;
