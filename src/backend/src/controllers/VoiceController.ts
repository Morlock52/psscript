import { Request, Response } from 'express';
import axios from 'axios';
import logger from '../utils/logger';
import { AIMetric } from '../middleware/aiAnalytics';

/**
 * Shared helper for AI service communication.
 */
const AI_SERVICE_URL = process.env.DOCKER_ENV === 'true'
  ? (process.env.AI_SERVICE_URL || 'http://ai-service:8000')
  : (process.env.AI_SERVICE_URL || 'http://localhost:8000');
const MAX_VOICE_TEXT_CHARS = Number(process.env.MAX_VOICE_TEXT_CHARS || 6000);
const MAX_AUDIO_DATA_B64_CHARS = Number(process.env.MAX_AUDIO_DATA_B64_CHARS || 16_000_000);
const ALLOWED_OUTPUT_FORMATS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'opus', 'pcm']);
const ALLOWED_RECOGNITION_FORMATS = new Set(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm']);

const getOpenAIApiKey = (req: Request): string => {
  const headerKey = req.headers['x-openai-api-key'];
  const bodyKey = (req.body && typeof req.body === 'object' && req.body.api_key) || '';
  return (typeof headerKey === 'string' && headerKey.trim() ? headerKey : '')
    || (typeof bodyKey === 'string' && bodyKey.trim() ? bodyKey : '')
    || process.env.OPENAI_API_KEY
    || '';
};

const withRequestMetadata = (requestId: string, req: Request): string => {
  const userId = req.user?.id ? `user:${req.user.id}` : 'anonymous';
  return `[${requestId}] ${userId}`;
};

const buildAiHeaders = (apiKey: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  return headers;
};

const normalizeAiError = (error: any, context: string): [number, object] => {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      return [
        error.response.status,
        error.response.data || { error: `${context} failed` }
      ];
    }

    if (!error.response) {
      return [503, { error: 'AI service unavailable' }];
    }
  }

  return [500, { error: 'Internal server error' }];
};

const summarizeError = (error: unknown): Record<string, unknown> => {
  if (axios.isAxiosError(error)) {
    return {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    };
  }
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { value: String(error) };
};

const recordVoiceMetric = async (params: {
  req: Request;
  endpoint: string;
  model: string;
  latency: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> => {
  try {
    await AIMetric.create({
      userId: params.req.user?.id,
      endpoint: params.endpoint,
      model: params.model,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      latency: params.latency,
      success: params.success,
      errorMessage: params.errorMessage,
      requestPayload: {
        method: params.req.method,
        path: params.req.path
      },
      responsePayload: {
        status: params.success ? 200 : 500
      }
    });
  } catch (metricError) {
    logger.warn('Failed to record voice analytics metric', { error: summarizeError(metricError) });
  }
};

/**
 * Synthesize text into speech
 */
export const synthesizeSpeech = async (req: Request, res: Response): Promise<void> => {
  const requestId = Math.random().toString(36).substring(2, 10);
  const context = withRequestMetadata(requestId, req);
  const startedAt = Date.now();
  const model = process.env.VOICE_TTS_MODEL || 'gpt-4o-mini-tts';

  try {
    const { text, voiceId, outputFormat = 'mp3' } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }
    if (text.length > MAX_VOICE_TEXT_CHARS) {
      res.status(413).json({ error: `Text too long; max ${MAX_VOICE_TEXT_CHARS} characters` });
      return;
    }
    if (typeof outputFormat !== 'string' || !ALLOWED_OUTPUT_FORMATS.has(outputFormat.toLowerCase())) {
      res.status(400).json({ error: `Unsupported outputFormat. Allowed: ${Array.from(ALLOWED_OUTPUT_FORMATS).join(', ')}` });
      return;
    }

    const apiKey = getOpenAIApiKey(req);
    logger.info(`${context} Synthesizing voice text`);

    const response = await axios.post(
      `${AI_SERVICE_URL}/voice/synthesize`,
      {
        text: text.trim(),
        voice_id: voiceId,
        output_format: outputFormat
      },
      {
        headers: buildAiHeaders(apiKey),
        timeout: 30000
      }
    );

    await recordVoiceMetric({
      req,
      endpoint: '/api/voice/synthesize',
      model,
      latency: Date.now() - startedAt,
      success: true
    });
    res.status(200).json(response.data);
  } catch (error) {
    logger.error(`${context} Error in synthesizeSpeech`, { error: summarizeError(error) });
    await recordVoiceMetric({
      req,
      endpoint: '/api/voice/synthesize',
      model,
      latency: Date.now() - startedAt,
      success: false,
      errorMessage: axios.isAxiosError(error)
        ? `${error.response?.status || 500} ${error.message}`
        : (error instanceof Error ? error.message : String(error))
    });
    const [status, payload] = normalizeAiError(error, 'synthesize speech');
    res.status(status).json(payload);
  }
};

/**
 * Recognize speech from audio data
 */
export const recognizeSpeech = async (req: Request, res: Response): Promise<void> => {
  const requestId = Math.random().toString(36).substring(2, 10);
  const context = withRequestMetadata(requestId, req);
  const startedAt = Date.now();
  const model = process.env.VOICE_STT_MODEL || 'gpt-4o-mini-transcribe';

  try {
    const { audioData, language = 'en-US', audioFormat } = req.body || {};

    if (!audioData || typeof audioData !== 'string') {
      res.status(400).json({ error: 'Audio data is required' });
      return;
    }
    if (audioData.length > MAX_AUDIO_DATA_B64_CHARS) {
      res.status(413).json({ error: `Audio payload too large; max ${MAX_AUDIO_DATA_B64_CHARS} base64 chars` });
      return;
    }
    if (audioFormat && (typeof audioFormat !== 'string' || !ALLOWED_RECOGNITION_FORMATS.has(audioFormat.toLowerCase()))) {
      res.status(400).json({ error: `Unsupported audioFormat. Allowed: ${Array.from(ALLOWED_RECOGNITION_FORMATS).join(', ')}` });
      return;
    }

    const apiKey = getOpenAIApiKey(req);
    logger.info(`${context} Recognizing speech`);

    const response = await axios.post(
      `${AI_SERVICE_URL}/voice/recognize`,
      {
        audio_data: audioData,
        language,
        audio_format: audioFormat
      },
      {
        headers: buildAiHeaders(apiKey),
        timeout: 30000
      }
    );

    await recordVoiceMetric({
      req,
      endpoint: '/api/voice/recognize',
      model,
      latency: Date.now() - startedAt,
      success: true
    });
    res.status(200).json(response.data);
  } catch (error) {
    logger.error(`${context} Error in recognizeSpeech`, { error: summarizeError(error) });
    await recordVoiceMetric({
      req,
      endpoint: '/api/voice/recognize',
      model,
      latency: Date.now() - startedAt,
      success: false,
      errorMessage: axios.isAxiosError(error)
        ? `${error.response?.status || 500} ${error.message}`
        : (error instanceof Error ? error.message : String(error))
    });
    const [status, payload] = normalizeAiError(error, 'recognize speech');
    res.status(status).json(payload);
  }
};

/**
 * Get available voices
 */
export const getVoices = async (_req: Request, res: Response): Promise<void> => {
  try {
    // OpenAI built-in voices (current as of Feb 2026).
    const voices = [
      { id: 'alloy', name: 'Alloy', provider: 'openai' },
      { id: 'ash', name: 'Ash', provider: 'openai' },
      { id: 'ballad', name: 'Ballad', provider: 'openai' },
      { id: 'coral', name: 'Coral', provider: 'openai' },
      { id: 'echo', name: 'Echo', provider: 'openai' },
      { id: 'fable', name: 'Fable', provider: 'openai' },
      { id: 'onyx', name: 'Onyx', provider: 'openai' },
      { id: 'nova', name: 'Nova', provider: 'openai' },
      { id: 'sage', name: 'Sage', provider: 'openai' },
      { id: 'shimmer', name: 'Shimmer', provider: 'openai' },
      { id: 'verse', name: 'Verse', provider: 'openai' },
      { id: 'marin', name: 'Marin', provider: 'openai' },
      { id: 'cedar', name: 'Cedar', provider: 'openai' }
    ];

    res.status(200).json({ voices });
  } catch (error) {
    logger.error('Error in getVoices', { error: summarizeError(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get user voice settings
 */
export const getVoiceSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || 'anonymous';
    logger.info(`Getting voice settings for ${userId}`);

    const settings = {
      voiceId: 'alloy',
      autoPlay: true,
      volume: 0.8,
      speed: 1.0
    };

    res.status(200).json(settings);
  } catch (error) {
    logger.error('Error in getVoiceSettings', { error: summarizeError(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update user voice settings
 */
export const updateVoiceSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { voiceId, autoPlay, volume, speed } = req.body || {};

    logger.info(`Updating voice settings for ${userId}`);

    const settings = {
      voiceId: voiceId || 'alloy',
      autoPlay: autoPlay !== undefined ? autoPlay : true,
      volume: typeof volume === 'number' ? volume : 0.8,
      speed: typeof speed === 'number' ? speed : 1.0
    };

    res.status(200).json(settings);
  } catch (error) {
    logger.error('Error in updateVoiceSettings', { error: summarizeError(error) });
    res.status(500).json({ error: 'Internal server error' });
  }
};
