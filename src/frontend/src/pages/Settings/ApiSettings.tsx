import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import SettingsLayout from './SettingsLayout';
import { getApiUrl } from '../../utils/apiUrl';

interface ProviderKeyConfig {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  docsUrl: string;
  envKey: string;
}

interface OllamaModelEntry {
  name: string;
  model?: string;
  size?: number;
  size_vram?: number;
  context_length?: number;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OpenAIModelEntry {
  id: string;
  owned_by?: string;
  created?: number;
}

interface GoogleModelEntry {
  id: string;
  displayName: string;
  rawName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

// Ollama-only mode: cloud provider key management is intentionally disabled.
const PROVIDER_KEYS: ProviderKeyConfig[] = [];

const ApiSettings: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [useEnvVariables, setUseEnvVariables] = useState(true);
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(
    localStorage.getItem('ollama_base_url') || import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'
  );
  const [ollamaModel, setOllamaModel] = useState(
    localStorage.getItem('ollama_model') || import.meta.env.VITE_OLLAMA_MODEL || 'llama3.1'
  );
  const [isTestingOllama, setIsTestingOllama] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isScanningModels, setIsScanningModels] = useState(false);
  const [availableOllamaModels, setAvailableOllamaModels] = useState<OllamaModelEntry[]>([]);
  const [ollamaLimitNotes, setOllamaLimitNotes] = useState<string[]>([]);
  const [isScanningOpenAIModels, setIsScanningOpenAIModels] = useState(false);
  const [availableOpenAIModels, setAvailableOpenAIModels] = useState<OpenAIModelEntry[]>([]);
  const [openAIModelStatus, setOpenAIModelStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedOpenAIModel, setSelectedOpenAIModel] = useState(localStorage.getItem('openai_model') || '');
  const [isScanningGoogleModels, setIsScanningGoogleModels] = useState(false);
  const [availableGoogleModels, setAvailableGoogleModels] = useState<GoogleModelEntry[]>([]);
  const [googleModelStatus, setGoogleModelStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedGoogleModel, setSelectedGoogleModel] = useState(localStorage.getItem('google_model') || '');

  const envAvailability = useMemo(() => {
    const available: Record<string, boolean> = {};
    PROVIDER_KEYS.forEach((cfg) => {
      available[cfg.id] = Boolean(import.meta.env[cfg.envKey]);
    });
    return available;
  }, []);

  useEffect(() => {
    const next: Record<string, string> = {};
    PROVIDER_KEYS.forEach((cfg) => {
      if (useEnvVariables && import.meta.env[cfg.envKey]) {
        next[cfg.id] = '';
      } else {
        next[cfg.id] = localStorage.getItem(cfg.id) || '';
      }
    });
    setProviderKeys(next);
  }, [useEnvVariables]);

  const getProviderKey = (cfg: ProviderKeyConfig): string => {
    if (useEnvVariables && envAvailability[cfg.id]) {
      const envValue = import.meta.env[cfg.envKey];
      return typeof envValue === 'string' ? envValue.trim() : '';
    }
    return providerKeys[cfg.id]?.trim() || '';
  };

  const fetchJson = async (url: string, headers: Record<string, string>) => {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      let details = '';
      try {
        const errorBody = await response.json();
        details = errorBody?.error?.message || errorBody?.error || '';
      } catch (_error) {
        // non-JSON error response
      }

      throw new Error(details || `Request failed with status ${response.status}`);
    }

    return response.json();
  };

  const normalizeOpenAIModels = (responseBody: unknown): OpenAIModelEntry[] => {
    const models: OpenAIModelEntry[] = Array.isArray((responseBody as any)?.data)
      ? (responseBody as any).data
          .filter((model: any) => typeof model?.id === 'string' && model.id.trim())
          .map((model: any) => ({
            id: model.id,
            owned_by: typeof model?.owned_by === 'string' ? model.owned_by : undefined,
            created: typeof model?.created === 'number' ? model.created : undefined,
          }))
      : [];

    const seen = new Set<string>();
    return models
      .filter((model) => {
        if (seen.has(model.id)) return false;
        seen.add(model.id);
        return true;
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  };

  const normalizeGoogleModels = (responseBody: unknown): GoogleModelEntry[] => {
    const models: GoogleModelEntry[] = Array.isArray((responseBody as any)?.models)
      ? (responseBody as any).models
          .filter((item: any) => {
            if (typeof item?.name !== 'string') return false;
            const methods = Array.isArray(item?.supportedGenerationMethods) ? item.supportedGenerationMethods : [];
            return methods.includes('generateContent');
          })
          .map((item: any): GoogleModelEntry => {
            const rawName = String(item.name || '');
            const id = rawName.replace(/^models\//, '');
            const methods = Array.isArray(item?.supportedGenerationMethods)
              ? item.supportedGenerationMethods
              : [];
            return {
              id,
              rawName,
              displayName: typeof item?.displayName === 'string' && item.displayName.trim()
                ? item.displayName.trim()
                : id,
              description: typeof item?.description === 'string' ? item.description : undefined,
              inputTokenLimit: typeof item?.inputTokenLimit === 'number' ? item.inputTokenLimit : undefined,
              outputTokenLimit: typeof item?.outputTokenLimit === 'number' ? item?.outputTokenLimit : undefined,
              supportedGenerationMethods: methods,
            };
          })
      : [];

    const seen = new Set<string>();
    return models
      .filter((model) => {
        if (seen.has(model.id)) return false;
        seen.add(model.id);
        return true;
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  };

  const scanOpenAIModelsViaProxy = async (apiKey: string): Promise<OpenAIModelEntry[]> => {
    const url = `${getApiUrl()}/health/provider-models/openai`;
    const body = await fetchJson(url, {
      'x-openai-api-key': apiKey,
    });
    if (body?.status === 'ok') {
      return normalizeOpenAIModels({ data: body.models });
    }

    const fallbackError = (body?.error || body?.message || 'Unknown error');
    throw new Error(typeof fallbackError === 'string' ? fallbackError : 'Provider request failed');
  };

  const scanGoogleModelsViaProxy = async (apiKey: string): Promise<GoogleModelEntry[]> => {
    const url = `${getApiUrl()}/health/provider-models/google`;
    const body = await fetchJson(url, {
      'x-goog-api-key': apiKey,
    });
    if (body?.status === 'ok') {
      return normalizeGoogleModels(body);
    }

    const fallbackError = (body?.error || body?.message || 'Unknown error');
    throw new Error(typeof fallbackError === 'string' ? fallbackError : 'Provider request failed');
  };

  const scanGoogleModelsDirect = async (apiKey: string): Promise<GoogleModelEntry[]> => {
    let nextPageToken: string | undefined;
    const collected: GoogleModelEntry[] = [];

    do {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('key', apiKey);
      url.searchParams.set('pageSize', '100');
      if (nextPageToken) {
        url.searchParams.set('pageToken', nextPageToken);
      }

      const body = await fetchJson(url.toString(), {} as Record<string, string>);
      if (typeof body?.nextPageToken === 'string') {
        nextPageToken = body.nextPageToken;
      } else {
        nextPageToken = undefined;
      }
      collected.push(...normalizeGoogleModels(body));
    } while (nextPageToken);

    return collected;
  };

  const handleProviderKeyChange = (id: string, value: string) => {
    setProviderKeys((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      PROVIDER_KEYS.forEach((cfg) => {
        const value = providerKeys[cfg.id] || '';
        if (value) {
          localStorage.setItem(cfg.id, value);
        } else {
          localStorage.removeItem(cfg.id);
        }
      });

      localStorage.setItem('ollama_base_url', ollamaBaseUrl.trim());
      localStorage.setItem('ollama_model', ollamaModel.trim());
      localStorage.setItem('model_provider', 'ollama');
      localStorage.removeItem('openai_model');
      localStorage.removeItem('google_model');
      localStorage.removeItem('openai_api_key');
      localStorage.removeItem('anthropic_api_key');
      localStorage.removeItem('google_api_key');

      setSaveMessage('Ollama settings saved. Active model provider: Ollama.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving API settings:', error);
      setSaveMessage('Error saving API settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const buildOllamaAttemptUrls = (base: string, path: '/api/tags' | '/api/ps'): string[] => {
    const urls: string[] = [`${window.location.origin}/ollama${path}`];
    urls.push(`${base}${path}`);

    const isLocalBase = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(base);
    const pageHost = window.location.hostname;
    if (isLocalBase && pageHost !== 'localhost' && pageHost !== '127.0.0.1') {
      urls.push(`${window.location.protocol}//${pageHost}:11434${path}`);
    }

    return urls;
  };

  const fetchFromAny = async (urls: string[]): Promise<any> => {
    let lastErr = 'Unknown error';
    for (const url of urls) {
      try {
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(details?.message || `HTTP ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        lastErr = `${url}: ${(error as Error).message}`;
      }
    }
    throw new Error(lastErr);
  };

  const scanOllamaModels = async () => {
    setIsScanningModels(true);
    setOllamaStatus(null);

    const base = ollamaBaseUrl.trim().replace(/\/+$/, '');
    if (!base) {
      setOllamaStatus({ type: 'error', message: 'Enter an Ollama base URL first.' });
      setIsScanningModels(false);
      return;
    }

    try {
      const tagsData = await fetchFromAny(buildOllamaAttemptUrls(base, '/api/tags'));
      const psData = await fetchFromAny(buildOllamaAttemptUrls(base, '/api/ps')).catch(() => ({ models: [] }));

      const tagsModels: OllamaModelEntry[] = Array.isArray(tagsData?.models) ? tagsData.models : [];
      const runningByName = new Map<string, OllamaModelEntry>();
      const runningModels: OllamaModelEntry[] = Array.isArray(psData?.models) ? psData.models : [];
      runningModels.forEach((m) => runningByName.set(m.name, m));

      const merged = tagsModels.map((model) => {
        const running = runningByName.get(model.name);
        return running
          ? {
              ...model,
              size_vram: running.size_vram ?? model.size_vram,
              context_length: running.context_length ?? model.context_length,
            }
          : model;
      });

      setAvailableOllamaModels(merged);

      if (merged.length > 0 && !merged.some((m) => m.name === ollamaModel)) {
        setOllamaModel(merged[0].name);
      }

      setOllamaStatus({
        type: 'success',
        message: `Scanned ${merged.length} Ollama models successfully.`,
      });
    } catch (error) {
      console.error('Ollama model scan failed:', error);
      setAvailableOllamaModels([]);
      setOllamaStatus({
        type: 'error',
        message: `Model scan failed: ${(error as Error).message}`,
      });
    } finally {
      setIsScanningModels(false);
    }
  };

  const scanOpenAIModels = async () => {
    const cfg = PROVIDER_KEYS.find((entry) => entry.id === 'openai_api_key');
    if (!cfg) return;

    const apiKey = getProviderKey(cfg);
    setIsScanningOpenAIModels(true);
    setOpenAIModelStatus(null);

    if (!apiKey) {
      setOpenAIModelStatus({
        type: 'error',
        message: 'Set an OpenAI API key first to scan available models.',
      });
      setIsScanningOpenAIModels(false);
      return;
    }

    try {
      let models: OpenAIModelEntry[] = [];
      try {
        models = await scanOpenAIModelsViaProxy(apiKey);
      } catch (_proxyError) {
        const data = await fetchJson('https://api.openai.com/v1/models', {
          Authorization: `Bearer ${apiKey}`,
        });
        models = normalizeOpenAIModels(data);
      }

      const sorted = models.sort((a, b) => a.id.localeCompare(b.id));
      setAvailableOpenAIModels(sorted);

      if (sorted.length > 0 && !sorted.some((model) => model.id === selectedOpenAIModel)) {
        setSelectedOpenAIModel(sorted[0].id);
      }

      setOpenAIModelStatus({
        type: 'success',
        message: `Detected ${sorted.length} OpenAI models.`,
      });
    } catch (error) {
      console.error('OpenAI model scan failed:', error);
      setOpenAIModelStatus({
        type: 'error',
        message: `Model scan failed: ${(error as Error).message}`,
      });
      setAvailableOpenAIModels([]);
    } finally {
      setIsScanningOpenAIModels(false);
    }
  };

  const scanGoogleModels = async () => {
    const cfg = PROVIDER_KEYS.find((entry) => entry.id === 'google_api_key');
    if (!cfg) return;

    const apiKey = getProviderKey(cfg);
    setIsScanningGoogleModels(true);
    setGoogleModelStatus(null);

    if (!apiKey) {
      setGoogleModelStatus({
        type: 'error',
        message: 'Set a Google API key first to scan available models.',
      });
      setIsScanningGoogleModels(false);
      return;
    }

    try {
      let models: GoogleModelEntry[] = [];
      try {
        models = await scanGoogleModelsViaProxy(apiKey);
      } catch (_proxyError) {
        models = await scanGoogleModelsDirect(apiKey);
      }

      const sorted = models.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setAvailableGoogleModels(sorted);

      if (sorted.length > 0 && !sorted.some((model) => model.id === selectedGoogleModel)) {
        setSelectedGoogleModel(sorted[0].id);
      }

      setGoogleModelStatus({
        type: 'success',
        message: `Detected ${sorted.length} Gemini models that support generateContent.`,
      });
    } catch (error) {
      console.error('Google model scan failed:', error);
      setGoogleModelStatus({
        type: 'error',
        message: `Model scan failed: ${(error as Error).message}`,
      });
      setAvailableGoogleModels([]);
    } finally {
      setIsScanningGoogleModels(false);
    }
  };

  const handleTestOllamaConnection = async () => {
    setIsTestingOllama(true);
    setOllamaStatus(null);

    const base = ollamaBaseUrl.trim().replace(/\/+$/, '');
    if (!base) {
      setOllamaStatus({ type: 'error', message: 'Enter an Ollama base URL first.' });
      setIsTestingOllama(false);
      return;
    }

    try {
      const attempts: Array<{ label: string; url: string }> = [];
      buildOllamaAttemptUrls(base, '/api/tags').forEach((url, idx) => {
        attempts.push({ label: `direct-path-${idx + 1}`, url });
      });
      const apiUrl = getApiUrl();
      attempts.push({ label: 'backend-proxy', url: `${apiUrl}/health/ollama?baseUrl=${encodeURIComponent(base)}` });

      let lastError = 'Unknown error';
      for (const attempt of attempts) {
        try {
          const response = await fetch(attempt.url, { method: 'GET' });
          if (!response.ok) {
            const details = await response.json().catch(() => ({}));
            throw new Error(details?.message || `HTTP ${response.status}`);
          }

          const details = await response.json().catch(() => ({}));
          const modelCount = Array.isArray(details?.models)
            ? details.models.length
            : (typeof details?.modelCount === 'number' ? details.modelCount : undefined);
          const countSuffix = typeof modelCount === 'number' ? ` (${modelCount} models detected)` : '';
          setOllamaStatus({
            type: 'success',
            message: `Ollama connection successful${countSuffix} via ${attempt.label}.`,
          });
          await scanOllamaModels();
          return;
        } catch (error) {
          lastError = `${attempt.label}: ${(error as Error).message}`;
        }
      }

      throw new Error(lastError);
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      setOllamaStatus({
        type: 'error',
        message: `Could not reach Ollama. Last attempt failed: ${(error as Error).message}`,
      });
    } finally {
      setIsTestingOllama(false);
    }
  };

  useEffect(() => {
    const selected = availableOllamaModels.find((m) => m.name === ollamaModel);
    if (!selected) {
      setOllamaLimitNotes([]);
      return;
    }

    const notes: string[] = [];
    const sizeGb = selected.size ? selected.size / (1024 ** 3) : null;
    if (sizeGb !== null) {
      notes.push(`Model file size: ${sizeGb.toFixed(1)} GB (disk + memory baseline).`);
    }

    if (selected.details?.parameter_size) {
      notes.push(`Parameter size: ${selected.details.parameter_size}. Larger models need more RAM/VRAM.`);
    }

    if (selected.details?.quantization_level) {
      notes.push(`Quantization: ${selected.details.quantization_level}. Lower-bit quantization usually reduces memory use.`);
    }

    if (selected.context_length) {
      notes.push(`Active context length: ${selected.context_length.toLocaleString()} tokens.`);
    } else {
      notes.push('Context length depends on Ollama settings and available VRAM.');
    }

    notes.push('Increasing context length requires more memory.');
    notes.push('If model is partially CPU-offloaded, generation speed drops.');
    notes.push('Parallel requests increase memory requirements.');
    notes.push('Ollama default context by VRAM tier: <24 GiB = 4K, 24-48 GiB = 32K, >=48 GiB = 256K.');

    setOllamaLimitNotes(notes);
  }, [availableOllamaModels, ollamaModel]);

  const saveDisabled =
    isSaving ||
    !ollamaBaseUrl.trim() ||
    !ollamaModel.trim();

  const toLocalDate = (createdTs?: number) => {
    if (!createdTs) return '';
    return new Date(createdTs * 1000).toLocaleDateString();
  };

  const renderCloudModelSelect = (cfg: ProviderKeyConfig) => {
    const isOpenAI = cfg.id === 'openai_api_key';
    const isGoogle = cfg.id === 'google_api_key';
    if (!isOpenAI && !isGoogle) {
      return null;
    }

    const isScanning = isOpenAI ? isScanningOpenAIModels : isScanningGoogleModels;
    const status = isOpenAI ? openAIModelStatus : googleModelStatus;
    const models = isOpenAI ? availableOpenAIModels : availableGoogleModels;
    const selectedModel = isOpenAI ? selectedOpenAIModel : selectedGoogleModel;
    const setModel = isOpenAI ? setSelectedOpenAIModel : setSelectedGoogleModel;
    const scanModels = isOpenAI ? scanOpenAIModels : scanGoogleModels;
    const label = isOpenAI ? 'Detected OpenAI Models' : 'Detected Google Models';

    return (
      <div style={{ marginTop: 16 }}>
        <FormControl fullWidth margin="normal">
          <InputLabel id={`${cfg.id}-model-label`}>{label}</InputLabel>
          <Select
            labelId={`${cfg.id}-model-label`}
            value={selectedModel}
            label={label}
            onChange={(event) => setModel(String(event.target.value))}
          >
            {models.length === 0 ? (
              <MenuItem value="" disabled>
                Scan to load models
              </MenuItem>
            ) : (
              models.map((model) => {
                if (isOpenAI) {
                  const openAiModel = model as OpenAIModelEntry;
                  const created = openAiModel.created ? ` • created ${toLocalDate(openAiModel.created)}` : '';
                  const owner = openAiModel.owned_by ? ` • owner ${openAiModel.owned_by}` : '';
                  return (
                    <MenuItem key={openAiModel.id} value={openAiModel.id}>
                      {openAiModel.id}{created}{owner}
                    </MenuItem>
                  );
                }

                const googleModel = model as GoogleModelEntry;
                const context = [
                  googleModel.inputTokenLimit ? `in ${googleModel.inputTokenLimit.toLocaleString()}` : '',
                  googleModel.outputTokenLimit ? `out ${googleModel.outputTokenLimit.toLocaleString()}` : '',
                ].filter(Boolean).join(' / ');
                const contextText = context ? ` (${context} tokens)` : '';
                return (
                  <MenuItem key={googleModel.id} value={googleModel.id}>
                    {googleModel.displayName} ({googleModel.id}){contextText}
                  </MenuItem>
                );
              })
            )}
          </Select>
        </FormControl>

        <Box sx={{ mt: 1.5, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => { void scanModels(); }}
            disabled={isScanning || !getProviderKey(cfg)}
            startIcon={isScanning ? <CircularProgress size={18} /> : null}
          >
            {isScanning ? `Scanning ${cfg.label}` : `Scan ${cfg.label} Models`}
          </Button>
          {status && (
            <Alert severity={status.type} sx={{ flex: 1, mb: 0 }}>
              {status.message}
            </Alert>
          )}
        </Box>
      </div>
    );
  };

  return (
    <SettingsLayout
      title="Ollama Model API"
      description="Configure and use Ollama as the active model provider."
    >
      <Typography variant="body1" paragraph>
        Cloud provider model keys are disabled in this configuration. This section manages only your Ollama connection and model selection.
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        Active provider is locked to Ollama. Save settings to apply `model_provider=ollama`.
      </Alert>

      {saveMessage && (
        <Alert severity={saveMessage.includes('Error') ? 'error' : 'success'} sx={{ mb: 3 }}>
          {saveMessage}
        </Alert>
      )}

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" gutterBottom>
        Ollama Connection
      </Typography>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <TextField
            label="Ollama Base URL"
            value={ollamaBaseUrl}
            onChange={(e) => setOllamaBaseUrl(e.target.value)}
            placeholder="http://localhost:11434"
            fullWidth
            margin="normal"
            variant="outlined"
            helperText="Example: http://localhost:11434"
          />

          <TextField
            label="Default Ollama Model"
            value={ollamaModel}
            onChange={(e) => setOllamaModel(e.target.value)}
            placeholder="llama3.1"
            fullWidth
            margin="normal"
            variant="outlined"
          />

          <FormControl fullWidth margin="normal">
            <InputLabel id="ollama-model-select-label">Detected Ollama Models</InputLabel>
            <Select
              labelId="ollama-model-select-label"
              value={availableOllamaModels.some((m) => m.name === ollamaModel) ? ollamaModel : ''}
              label="Detected Ollama Models"
              onChange={(e) => setOllamaModel(String(e.target.value))}
            >
              {availableOllamaModels.length === 0 ? (
                <MenuItem value="" disabled>
                  No scanned models yet
                </MenuItem>
              ) : (
                availableOllamaModels.map((model) => (
                  <MenuItem key={model.name} value={model.name}>
                    {model.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {ollamaLimitNotes.length > 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Selected model limitations (easy view)
              </Typography>
              <ul className="list-disc pl-5">
                {ollamaLimitNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <Box sx={{ mt: 1 }}>
                <Link href="https://docs.ollama.com/context-length" target="_blank" rel="noopener">
                  Ollama context-length docs
                </Link>
                {' | '}
                <Link href="https://docs.ollama.com/faq" target="_blank" rel="noopener">
                  Ollama FAQ (performance/memory)
                </Link>
              </Box>
            </Alert>
          )}

          {ollamaStatus && (
            <Alert severity={ollamaStatus.type} sx={{ mt: 2 }}>
              {ollamaStatus.message}
            </Alert>
          )}

          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => void handleTestOllamaConnection()}
              disabled={isTestingOllama || !ollamaBaseUrl.trim()}
              startIcon={isTestingOllama ? <CircularProgress size={18} /> : null}
            >
              {isTestingOllama ? 'Testing...' : 'Test Ollama Connection'}
            </Button>
            <Button
              variant="outlined"
              onClick={() => void scanOllamaModels()}
              disabled={isScanningModels || !ollamaBaseUrl.trim()}
              startIcon={isScanningModels ? <CircularProgress size={18} /> : null}
            >
              {isScanningModels ? 'Scanning...' : 'Scan Ollama Models'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={saveDisabled}
          startIcon={isSaving ? <CircularProgress size={20} /> : null}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </SettingsLayout>
  );
};

export default ApiSettings;
