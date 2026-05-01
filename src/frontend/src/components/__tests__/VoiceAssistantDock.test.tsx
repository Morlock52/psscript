import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import VoiceAssistantDock from '../VoiceAssistantDock';
import voiceService from '../../services/voiceService';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/voiceService', () => ({
  default: {
    getVoices: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    recognizeSpeech: vi.fn(),
    synthesizeSpeech: vi.fn(),
  },
}));

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const { useAuth } = await import('../../hooks/useAuth');
const { toast } = await import('react-toastify');

let lastRecorder: MockMediaRecorder | null = null;
let now = 1000;

class MockMediaRecorder {
  static isTypeSupported = vi.fn((mimeType: string) => mimeType === 'audio/webm;codecs=opus');
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void | Promise<void>) | null = null;
  state = 'inactive';

  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType || 'audio/webm';
    lastRecorder = this;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({
      data: new Blob([new Uint8Array(512)], { type: this.mimeType }),
    });
    void this.onstop?.();
  }
}

function setupAuth(user: null | { isEnabled?: boolean } = {}) {
  vi.mocked(useAuth).mockReturnValue({
    user: user === null ? null : {
      id: 'user-1',
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      created_at: '2026-05-01T00:00:00Z',
      ...user,
    },
    isAuthenticated: user !== null,
    isLoading: false,
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    completeOAuthLogin: vi.fn(),
    defaultLogin: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser: vi.fn(),
    error: null,
    clearError: vi.fn(),
  });
}

function setupVoiceService() {
  vi.mocked(voiceService.getVoices).mockResolvedValue({
    voices: [{ id: 'marin', name: 'Marin', provider: 'openai' }],
  });
  vi.mocked(voiceService.getSettings).mockResolvedValue({
    voiceId: 'marin',
    autoPlay: true,
    volume: 0.9,
    speed: 1,
  });
  vi.mocked(voiceService.updateSettings).mockResolvedValue({
    voiceId: 'marin',
    autoPlay: true,
    volume: 0.9,
    speed: 1,
  });
  vi.mocked(voiceService.recognizeSpeech).mockResolvedValue({ text: 'Get-Process' });
  vi.mocked(voiceService.synthesizeSpeech).mockResolvedValue({
    audio_data: 'UklGRg==',
    format: 'mp3',
    duration: 0,
    text: 'Read this',
  });
}

function installMediaMocks() {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  });
  Object.defineProperty(window, 'MediaRecorder', {
    configurable: true,
    writable: true,
    value: MockMediaRecorder,
  });
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    writable: true,
    value: MockMediaRecorder,
  });
}

describe('VoiceAssistantDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('auth_token', 'real-token');
    setupAuth();
    setupVoiceService();
    installMediaMocks();
    lastRecorder = null;
    now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the voice pill for authenticated users only', () => {
    const { rerender } = render(<VoiceAssistantDock />);
    expect(screen.getByRole('button', { name: 'Voice' })).toBeInTheDocument();

    setupAuth(null);
    rerender(<VoiceAssistantDock />);
    expect(screen.queryByRole('button', { name: 'Voice' })).not.toBeInTheDocument();
  });

  it('inserts dictated text into the last focused textarea after dock controls take focus', async () => {
    const user = userEvent.setup();
    render(
      <>
        <textarea aria-label="Review notes" defaultValue="Before " />
        <VoiceAssistantDock />
      </>
    );

    const notes = screen.getByLabelText('Review notes') as HTMLTextAreaElement;
    notes.focus();
    notes.setSelectionRange(notes.value.length, notes.value.length);

    await user.click(screen.getByRole('button', { name: 'Voice' }));
    await user.click(screen.getByRole('button', { name: /dictate to input/i }));
    expect(lastRecorder).not.toBeNull();

    now = 2000;
    await user.click(screen.getByRole('button', { name: /stop dictation/i }));

    await waitFor(() => expect(notes.value).toBe('Before Get-Process'));
    expect(voiceService.recognizeSpeech).toHaveBeenCalledWith(expect.objectContaining({
      audioFormat: 'webm',
      transcriptionMode: 'standard',
    }));
    expect(screen.getByText('Transcript inserted into focused input')).toBeInTheDocument();
  });

  it('keeps the transcript in the dock when no editable target is available', async () => {
    const user = userEvent.setup();
    render(<VoiceAssistantDock />);

    await user.click(screen.getByRole('button', { name: 'Voice' }));
    await user.click(screen.getByRole('button', { name: /dictate to input/i }));

    now = 2000;
    await user.click(screen.getByRole('button', { name: /stop dictation/i }));

    await waitFor(() => expect(screen.getByLabelText(/last transcript/i)).toHaveValue('Get-Process'));
    expect(screen.getByText('Transcript ready')).toBeInTheDocument();
  });

  it('does not send too-short recordings to the voice API', async () => {
    const user = userEvent.setup();
    render(<VoiceAssistantDock />);

    await user.click(screen.getByRole('button', { name: 'Voice' }));
    await user.click(screen.getByRole('button', { name: /dictate to input/i }));

    now = 1100;
    await user.click(screen.getByRole('button', { name: /stop dictation/i }));

    await waitFor(() => expect(screen.getByText('Recording too short')).toBeInTheDocument());
    expect(voiceService.recognizeSpeech).not.toHaveBeenCalled();
  });

  it('reports unsupported browser recording before requesting microphone access', async () => {
    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const user = userEvent.setup();
    render(<VoiceAssistantDock />);

    await user.click(screen.getByRole('button', { name: 'Voice' }));
    await user.click(screen.getByRole('button', { name: /dictate to input/i }));

    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('This browser does not support microphone recording.');
  });

  it('sends selected text to speech synthesis', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('Audio', vi.fn().mockImplementation(function MockAudio() {
      return { play, pause: vi.fn(), volume: 0 };
    }));
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'Read this' } as Selection);
    const user = userEvent.setup();
    render(<VoiceAssistantDock />);

    await user.click(screen.getByRole('button', { name: 'Voice' }));
    await user.click(screen.getByRole('button', { name: /speak selection/i }));

    await waitFor(() => expect(voiceService.synthesizeSpeech).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Read this',
      voiceId: 'marin',
      outputFormat: 'mp3',
    })));
    expect(play).toHaveBeenCalled();
    expect(screen.getByLabelText('Generated speech')).toBeInTheDocument();
  });

  it('keeps generated speech playable when browser autoplay is blocked', async () => {
    const play = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    vi.stubGlobal('Audio', vi.fn().mockImplementation(function MockAudio() {
      return { play, pause: vi.fn(), volume: 0 };
    }));
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'Read this' } as Selection);
    const user = userEvent.setup();
    render(<VoiceAssistantDock />);

    await user.click(screen.getByRole('button', { name: 'Voice' }));
    await user.click(screen.getByRole('button', { name: /speak selection/i }));

    await waitFor(() => expect(screen.getByText('Speech ready - press play')).toBeInTheDocument());
    expect(screen.getByLabelText('Generated speech')).toBeInTheDocument();
    expect(toast.info).toHaveBeenCalledWith('Speech is ready. Press play in the voice dock.');
  });

  it('falls back to browser speech when hosted synthesis fails', async () => {
    vi.mocked(voiceService.synthesizeSpeech).mockRejectedValue(new Error('invalid_issuer'));
    const speak = vi.fn();
    const cancel = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak, cancel },
    });
    vi.stubGlobal('SpeechSynthesisUtterance', vi.fn().mockImplementation(function MockUtterance(text: string) {
      return { text, rate: 1 };
    }));
    const user = userEvent.setup();
    render(<VoiceAssistantDock />);

    await user.click(screen.getByRole('button', { name: 'Voice' }));
    await user.type(screen.getByLabelText(/last transcript/i), 'Get-Date');
    await user.click(screen.getByRole('button', { name: /speak selection/i }));

    await waitFor(() => expect(screen.getByText('Speaking with browser voice')).toBeInTheDocument());
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('Hosted voice is unavailable. Using browser speech instead.');
  });
});
