import React from 'react';
import { Alert, Card, CardContent, Link, Typography } from '@mui/material';

type ProviderLink = {
  name: string;
  description: string;
  url: string;
};

const providerLinks: ProviderLink[] = [
  {
    name: 'OpenAI',
    description: 'Model inference and coding workflows',
    url: 'https://platform.openai.com/settings/organization/api-keys',
  },
  {
    name: 'Anthropic',
    description: 'Claude-based analysis and fallback inference',
    url: 'https://console.anthropic.com/settings/keys',
  },
  {
    name: 'Google Cloud',
    description: 'Google API credentials used by backend integrations',
    url: 'https://console.cloud.google.com/apis/credentials',
  },
];

const ApiSettings: React.FC = () => {
  return (
    <div className="p-6">
      <Typography variant="h4" component="h1" gutterBottom>
        API Settings
      </Typography>
      <Typography variant="body1" paragraph>
        External provider credentials are configured on the server, not in the browser.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        This page is intentionally read-only. API keys must be stored in backend environment variables or a
        server-side secret manager so they are never exposed to browser storage or bundled client code.
      </Alert>

      <div className="grid grid-cols-1 gap-4">
        {providerLinks.map((provider) => (
          <Card key={provider.name} variant="outlined">
            <CardContent>
              <Typography variant="h6" component="h2" gutterBottom>
                {provider.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {provider.description}
              </Typography>
              <Link href={provider.url} target="_blank" rel="noopener noreferrer">
                Open provider key management
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ApiSettings;
