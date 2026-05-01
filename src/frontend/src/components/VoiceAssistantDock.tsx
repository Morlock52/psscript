import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import voiceService, { VoiceOption, VoiceSettings } from '../services/voiceService';

const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];
const MIN_RECORDING_MS = 350;
const MIN_AUDIO_BYTES = 128;

type EditableTarget = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

function selectRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') {
    return undefined;
  }

  return SUPPORTED_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function mimeTypeToAudioFormat(mimeType: string | undefined): string {
  if (!mimeType) {
    return 'webm';
  }
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }
  if (mimeType.includes('mp4')) {
    return 'm4a';
  }
  return 'webm';
}

function audioFormatToMimeType(format: string): string {
  switch (format) {
    case 'wav':
      return 'audio/wav';
    case 'flac':
      return 'audio/flac';
    case 'opus':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    case 'ogg':
      return 'audio/ogg';
    case 'pcm':
      return 'audio/L16';
    case 'mp3':
    default:
      return 'audio/mpeg';
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read recorded audio'));
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

function isEditableTarget(target: Element | null): target is EditableTarget {
  if (!target) {
    return false;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return !target.disabled && !target.readOnly;
  }

  return target instanceof HTMLElement && target.isContentEditable;
}

function setNativeTextValue(target: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = target instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (descriptor?.set) {
    descriptor.set.call(target, value);
  } else {
    target.value = value;
  }
}

function dispatchEditableChange(target: Element) {
  if (typeof window.InputEvent === 'function') {
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  } else {
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

function insertTranscriptIntoActiveElement(text: string, target: Element | null): boolean {
  if (!isEditableTarget(target)) {
    return false;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const nextValue = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
    setNativeTextValue(target, nextValue);
    const caret = start + text.length;
    target.setSelectionRange(caret, caret);
    dispatchEditableChange(target);
    target.focus();
    return true;
  }

  target.focus();
  document.execCommand('insertText', false, text);
  dispatchEditableChange(target);
  return true;
}

function getSpeakableText(transcriptDraft: string): string {
  const selection = window.getSelection()?.toString().trim();
  if (selection) {
    return selection.slice(0, 4096);
  }

  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    const candidate = active.value?.trim();
    if (candidate) {
      return candidate.slice(0, 4096);
    }
  }

  if (transcriptDraft.trim()) {
    return transcriptDraft.trim().slice(0, 4096);
  }

  const main = document.querySelector('main');
  const content = main?.textContent?.replace(/\s+/g, ' ').trim() || '';
  return content.slice(0, 4096);
}

const defaultSettings: VoiceSettings = {
  voiceId: 'marin',
  autoPlay: true,
  volume: 0.9,
  speed: 1,
};

const VoiceAssistantDock: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>(defaultSettings);
  const [status, setStatus] = useState('Ready');
  const [audioUrl, setAudioUrl] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeElementRef = useRef<Element | null>(null);
  const lastEditableTargetRef = useRef<Element | null>(null);
  const recordingStartedAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasRealToken = useMemo(() => {
    const token = localStorage.getItem('auth_token');
    return !!user && user.isEnabled !== false && !!token && token !== 'dev-auth-disabled';
  }, [user]);

  useEffect(() => {
    if (!hasRealToken) {
      return;
    }

    let cancelled = false;

    const loadVoiceData = async () => {
      try {
        const [voiceResponse, settingsResponse] = await Promise.all([
          voiceService.getVoices(),
          voiceService.getSettings(),
        ]);

        if (cancelled) {
          return;
        }

        setVoices(voiceResponse.voices || []);
        setSettings((current) => ({
          ...current,
          ...settingsResponse,
        }));
      } catch (error) {
        if (!cancelled) {
          console.warn('Voice assistant initialization failed:', error);
        }
      }
    };

    loadVoiceData();

    return () => {
      cancelled = true;
    };
  }, [hasRealToken]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!hasRealToken) {
      return;
    }

    const rememberEditableTarget = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!isEditableTarget(target)) {
        return;
      }

      lastEditableTargetRef.current = target;
    };

    document.addEventListener('focusin', rememberEditableTarget, true);
    document.addEventListener('pointerdown', rememberEditableTarget, true);

    return () => {
      document.removeEventListener('focusin', rememberEditableTarget, true);
      document.removeEventListener('pointerdown', rememberEditableTarget, true);
    };
  }, [hasRealToken]);

  const persistSettings = async (nextSettings: Partial<VoiceSettings>) => {
    const mergedSettings = { ...settings, ...nextSettings };
    setSettings(mergedSettings);
    try {
      await voiceService.updateSettings(mergedSettings);
    } catch (error) {
      console.warn('Failed to persist voice settings:', error);
    }
  };

  const getDictationTarget = () => (
    isEditableTarget(document.activeElement)
      ? document.activeElement
      : lastEditableTargetRef.current
  );

  const startDictation = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('This browser does not support microphone recording.');
      return;
    }

    try {
      setStatus('Requesting microphone...');
      activeElementRef.current = getDictationTarget();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = selectRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      audioStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          setIsBusy(true);
          const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const durationMs = Date.now() - recordingStartedAtRef.current;
          if (!audioBlob.size || audioBlob.size < MIN_AUDIO_BYTES || durationMs < MIN_RECORDING_MS) {
            setStatus('Recording too short');
            toast.info('Hold dictation a little longer before stopping.');
            return;
          }

          setStatus('Transcribing...');
          const audioData = await blobToBase64(audioBlob);
          const recognition = await voiceService.recognizeSpeech({
            audioData,
            audioFormat: mimeTypeToAudioFormat(recorder.mimeType),
            language: 'en-US',
            transcriptionMode: 'standard',
          });
          const nextTranscript = recognition.text?.trim() || '';
          setTranscript(nextTranscript);

          if (nextTranscript) {
            const inserted = insertTranscriptIntoActiveElement(
              nextTranscript,
              activeElementRef.current || getDictationTarget()
            );

            if (inserted) {
              setStatus('Transcript inserted into focused input');
              toast.success('Voice transcript inserted.');
            } else {
              setStatus('Transcript ready');
              toast.info('Transcript captured. No editable field was focused.');
            }
          } else {
            setStatus('No speech detected');
            toast.info('No speech detected in the recording.');
          }
        } catch (error: any) {
          setStatus('Transcription failed');
          toast.error(error?.message || 'Voice transcription failed.');
        } finally {
          setIsBusy(false);
          setIsRecording(false);
          audioStreamRef.current?.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
          mediaRecorderRef.current = null;
        }
      };

      recorder.start();
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      setStatus('Listening...');
    } catch (error: any) {
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        setStatus('Microphone permission denied');
        toast.error(
          'Microphone access was denied. Click the lock icon in the address bar → Site Settings → allow Microphone, then try again.',
          { autoClose: 8000 }
        );
      } else if (error?.name === 'NotFoundError') {
        setStatus('No microphone found');
        toast.error('No microphone detected. Please connect a microphone and try again.');
      } else {
        setStatus('Microphone unavailable');
        toast.error(error?.message || 'Could not access the microphone.');
      }
    }
  };

  const stopDictation = () => {
    if (!mediaRecorderRef.current) {
      setStatus('Ready');
      return;
    }

    setStatus('Finishing recording...');
    mediaRecorderRef.current.stop();
  };

  const speakCurrentContext = async () => {
    const text = getSpeakableText(transcript);
    if (!text) {
      toast.info('Select text or focus an input to read it aloud.');
      return;
    }

    try {
      setIsBusy(true);
      setAudioUrl('');
      setStatus('Generating speech...');
      const synthesis = await voiceService.synthesizeSpeech({
        text,
        voiceId: settings.voiceId || 'marin',
        outputFormat: 'mp3',
        speed: settings.speed || 1,
        voiceInstructions: 'Use a natural, confident assistant tone suitable for technical workflows.',
      });

      const nextAudioUrl = `data:${audioFormatToMimeType(synthesis.format)};base64,${synthesis.audio_data}`;
      setAudioUrl(nextAudioUrl);

      const audio = new Audio(nextAudioUrl);
      audio.volume = Math.max(0, Math.min(1, settings.volume || 0.9));
      audioRef.current?.pause();
      audioRef.current = audio;
      if (settings.autoPlay !== false) {
        try {
          await audio.play();
          setStatus('Speaking');
        } catch {
          setStatus('Speech ready - press play');
          toast.info('Speech is ready. Press play in the voice dock.');
        }
      } else {
        setStatus('Speech ready');
      }
    } catch (error: any) {
      const message = error?.message || 'Voice playback failed.';
      setStatus(message);
      toast.error(error?.message || 'Voice playback failed.');
    } finally {
      setIsBusy(false);
    }
  };

  if (!hasRealToken) {
    return null;
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 sm:bottom-4 sm:right-4">
      <div className="flex flex-col items-end gap-3">
        {isOpen && (
          <div className="max-h-[calc(100dvh-6rem)] w-[calc(100vw-1.5rem)] max-w-[22rem] overflow-y-auto rounded-3xl border border-[var(--surface-overlay)] bg-[var(--surface-raised)]/95 p-4 shadow-[var(--shadow-far)] backdrop-blur-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[var(--ink-tertiary)]">OpenAI Audio</p>
                <h3 className="text-sm font-bold text-[var(--ink-primary)]">Voice Copilot</h3>
                <p className="mt-1 text-xs text-[var(--ink-secondary)]">
                  Dictate into the focused input or read selected script context aloud.
                </p>
              </div>
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => setIsOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-[var(--ink-tertiary)] hover:bg-[var(--surface-overlay)]"
              >
                Close
              </button>
            </div>

            <div className="mb-3 rounded-lg border border-[var(--surface-overlay)] bg-[var(--surface-overlay)]/60 px-3 py-2 text-xs text-[var(--ink-secondary)]">
              Audio output is AI-generated. Use dictation only where microphone capture is approved.
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={isRecording ? stopDictation : startDictation}
                disabled={isBusy}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                  isRecording
                    ? 'border-red-900/30 bg-red-950/35 text-red-100 hover:bg-red-950/50'
                    : 'border-[var(--ink-muted)] bg-[var(--surface-overlay)] text-[var(--ink-primary)] hover:bg-[var(--surface-raised)]'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isRecording ? 'Stop dictation' : 'Dictate to input'}
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={speakCurrentContext}
                disabled={isBusy || isRecording}
                className="rounded-xl border border-[var(--ink-muted)] bg-[var(--surface-overlay)] px-3 py-3 text-sm font-medium text-[var(--ink-primary)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Speak selection
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-600 dark:text-slate-400">
                Voice
                <select
                  value={settings.voiceId}
                  onChange={(event) => void persistSettings({ voiceId: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {(voices.length ? voices : [{ id: 'marin', name: 'Marin', provider: 'openai' }]).map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-600 dark:text-slate-400">
                Speed
                <input
                  type="range"
                  min="0.75"
                  max="1.4"
                  step="0.05"
                  value={settings.speed}
                  onChange={(event) => void persistSettings({ speed: Number(event.target.value) })}
                  className="mt-3 w-full"
                />
                <span className="mt-1 block text-right text-[11px]">{settings.speed.toFixed(2)}x</span>
              </label>
            </div>

            <label className="mt-3 block text-xs text-slate-600 dark:text-slate-400">
              Last transcript
              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                rows={4}
                placeholder="Your last recognized speech will appear here."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>

            {audioUrl && (
              <audio
                controls
                src={audioUrl}
                className="mt-3 w-full"
                aria-label="Generated speech"
              />
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{status}</span>
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => navigator.clipboard.writeText(transcript)}
                disabled={!transcript.trim()}
                className="rounded-md px-2 py-1 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
              >
                Copy transcript
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((current) => !current)}
          className="rounded-full border border-[var(--ink-muted)] bg-[var(--surface-raised)]/95 px-4 py-3 text-sm font-black text-[var(--ink-primary)] shadow-[var(--shadow-near)] hover:bg-[var(--surface-overlay)] sm:px-5"
        >
          {isOpen ? 'Hide voice' : 'Voice'}
        </button>
      </div>
    </div>
  );
};

export default VoiceAssistantDock;
