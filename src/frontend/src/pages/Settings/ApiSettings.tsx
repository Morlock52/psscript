import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, CardContent, Chip, Link, TextField, Typography } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { getApiUrl } from '../../utils/apiUrl';

type ProviderLink = {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  description: string;
  url: string;
};

type ProviderStatus = {
  provider: 'openai' | 'anthropic';
  label: string;
  configured: boolean;
  source: 'database' | 'environment' | 'missing';
  keyHint: string;
  formatValid?: boolean;
  formatMessage?: string | null;
  updatedAt: string | null;
};

function isEditableProvider(provider: ProviderLink['provider']): provider is ProviderStatus['provider'] {
  return provider === 'openai' || provider === 'anthropic';
}

const providerLinks: ProviderLink[] = [
  {
    name: 'OpenAI',
    provider: 'openai',
    description: 'Model inference and coding workflows',
    url: 'https://platform.openai.com/settings/organization/api-keys',
  },
  {
    name: 'Anthropic',
    provider: 'anthropic',
    description: 'Claude-based analysis and fallback inference',
    url: 'https://console.anthropic.com/settings/keys',
  },
  {
    name: 'Google Cloud',
    provider: 'google',
    description: 'Google API credentials used by backend integrations',
    url: 'https://console.cloud.google.com/apis/credentials',
  },
];

const ApiSettings: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null);

  const providerStatuses = useMemo(
    () => new Map(providers.map(provider => [provider.provider, provider])),
    [providers]
  );

  const authHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const loadProviderStatuses = async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/admin/api-keys`, {
        headers: authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Could not load provider key status');
      }
      setProviders(payload.providers || []);
    } catch (error: any) {
      setMessage({ severity: 'error', text: error?.message || 'Could not load provider key status' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProviderStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const saveProviderKey = async (provider: ProviderStatus['provider']) => {
    const apiKey = apiKeys[provider]?.trim() || '';
    if (!apiKey) {
      setMessage({ severity: 'error', text: 'Enter an API key before saving.' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/admin/api-keys/${provider}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ apiKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Could not save API key');
      }
      setApiKeys(current => ({ ...current, [provider]: '' }));
      setMessage({ severity: 'success', text: `${payload.provider} API key saved.` });
      await loadProviderStatuses();
    } catch (error: any) {
      setMessage({ severity: 'error', text: error?.message || 'Could not save API key' });
    } finally {
      setIsLoading(false);
    }
  };

  const clearProviderKey = async (provider: ProviderStatus['provider']) => {
    if (!window.confirm('Clear the database override for this provider key? The app will fall back to the deployment environment key if one exists.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/admin/api-keys/${provider}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Could not clear API key');
      }
      setMessage({ severity: 'success', text: `${provider} database key cleared.` });
      await loadProviderStatuses();
    } catch (error: any) {
      setMessage({ severity: 'error', text: error?.message || 'Could not clear API key' });
    } finally {
      setIsLoading(false);
    }
  };

  const testProviderKey = async (provider: ProviderStatus['provider']) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/admin/api-keys/${provider}/test`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload?.message || payload?.error || 'Provider key validation failed');
      }
      setMessage({ severity: 'success', text: payload.message || `${provider} API key is valid.` });
    } catch (error: any) {
      setMessage({ severity: 'error', text: error?.message || 'Provider key validation failed' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Typography variant="h4" component="h1" gutterBottom>
        API Settings
      </Typography>
      <Typography variant="body1" paragraph>
        External provider credentials are stored on the server and are never returned to the browser.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        API keys saved here are encrypted server-side and override deployment environment keys. Leave a field
        blank to keep the current key.
      </Alert>
      {!isAdmin && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Only admins can update provider API keys.
        </Alert>
      )}
      {message && (
        <Alert severity={message.severity} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4">
        {providerLinks.map((provider) => {
          const status = isEditableProvider(provider.provider)
            ? providerStatuses.get(provider.provider)
            : undefined;
          return (
            <Card key={provider.name} variant="outlined">
              <CardContent>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Typography variant="h6" component="h2">
                    {provider.name}
                  </Typography>
                  {status && (
                    <Chip
                      size="small"
                      color={status.configured ? 'success' : 'default'}
                      label={status.configured
                        ? `Configured via ${status.source}`
                        : 'Not configured'}
                    />
                  )}
                </div>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {provider.description}
                </Typography>
                {status?.configured && status.formatValid === false && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {status.formatMessage || `${provider.name} API key format is not recognized.`}
                  </Alert>
                )}
                {isEditableProvider(provider.provider) && isAdmin && (
                  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                    <TextField
                      label={`${provider.name} API key`}
                      type="password"
                      autoComplete="off"
                      value={apiKeys[provider.provider] || ''}
                      onChange={(event) => setApiKeys(current => ({
                        ...current,
                        [provider.provider]: event.target.value,
                      }))}
                      helperText={providerStatuses.get(provider.provider)?.keyHint
                        ? `Current: ${providerStatuses.get(provider.provider)?.keyHint}`
                        : 'No key is currently configured.'}
                      size="small"
                      disabled={isLoading}
                    />
                    <Button
                      variant="contained"
                      onClick={() => void saveProviderKey(provider.provider as ProviderStatus['provider'])}
                      disabled={isLoading || !(apiKeys[provider.provider] || '').trim()}
                    >
                      Save key
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => void testProviderKey(provider.provider as ProviderStatus['provider'])}
                      disabled={isLoading || !providerStatuses.get(provider.provider)?.configured}
                    >
                      Test key
                    </Button>
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={() => void clearProviderKey(provider.provider as ProviderStatus['provider'])}
                      disabled={isLoading || providerStatuses.get(provider.provider)?.source !== 'database'}
                    >
                      Clear override
                    </Button>
                  </div>
                )}
                <Link href={provider.url} target="_blank" rel="noopener noreferrer">
                  Open provider key management
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ApiSettings;
