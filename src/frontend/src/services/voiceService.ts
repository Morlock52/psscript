import { getApiUrl } from '../utils/apiUrl';

export interface VoiceOption {
  id: string;
  name: string;
  provider: string;
}

export interface VoiceSettings {
  voiceId: string;
  autoPlay: boolean;
  volume: number;
  speed: number;
}

export interface VoiceSynthesisResponse {
  audio_data: string;
  format: string;
  duration: number;
  text: string;
}

export interface VoiceRecognitionResponse {
  text?: string | null;
  segments?: unknown[];
  confidence?: number;
  language?: string;
  duration?: number;
  model?: string;
  mode?: string;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init.headers || {}),
    },
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Voice request failed (${response.status})`);
  }

  return payload as T;
}

export const voiceService = {
  getVoices(): Promise<{ voices: VoiceOption[] }> {
    return requestJson('/voice/voices');
  },

  getSettings(): Promise<VoiceSettings> {
    return requestJson('/voice/settings');
  },

  updateSettings(settings: Partial<VoiceSettings>): Promise<VoiceSettings> {
    return requestJson('/voice/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  synthesizeSpeech(payload: {
    text: string;
    voiceId: string;
    outputFormat?: string;
    speed?: number;
    voiceInstructions?: string;
  }): Promise<VoiceSynthesisResponse> {
    return requestJson('/voice/synthesize', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  recognizeSpeech(payload: {
    audioData: string;
    audioFormat?: string;
    language?: string;
    prompt?: string;
    transcriptionMode?: 'standard' | 'diarize';
  }): Promise<VoiceRecognitionResponse> {
    return requestJson('/voice/recognize', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export default voiceService;
