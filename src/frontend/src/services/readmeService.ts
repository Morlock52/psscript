import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

// Prefer backend-served README so the in-app docs match the running codebase
// and work offline in Docker (backend can read from a bind mount).
export const getReadmeContent = async (): Promise<string> => {
  try {
    const resp = await axios.get(`${getApiUrl()}/docs/readme`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    const content = String(resp?.data?.content || '');
    if (content.trim().length > 0) return content;
    throw new Error('Empty README content');
  } catch (error) {
    // Fallback: keep UI usable if backend endpoint is unavailable.
    console.error('Failed to fetch README:', error);
    return `# README Unavailable

The backend documentation endpoint is unavailable.

Start the stack and try again:

\`\`\`bash
docker compose --env-file .env up -d --build
\`\`\`
`;
  }
};

