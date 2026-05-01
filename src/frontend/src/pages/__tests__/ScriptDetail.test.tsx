import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ScriptDetail from '../ScriptDetail';
import { categoryService, scriptService } from '../../services/api';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/supabase', () => ({
  isHostedStaticAnalysisOnly: vi.fn(() => true),
}));

vi.mock('../../components/ScriptDownloadButton', () => ({
  default: () => <button type="button">Download</button>,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../services/api', () => ({
  scriptService: {
    getScript: vi.fn(),
    getScriptAnalysis: vi.fn(),
    getSimilarScripts: vi.fn(),
    getScriptVersions: vi.fn(),
    executeScript: vi.fn(),
    updateScript: vi.fn(),
    archiveScript: vi.fn(),
  },
  categoryService: {
    getCategories: vi.fn(),
  },
}));

const { useAuth } = await import('../../hooks/useAuth');

const baseScript = {
  id: '42',
  title: 'Original Script',
  description: 'Original description',
  content: 'Get-Process',
  categoryId: 1,
  category: { id: 1, name: 'Operations' },
  isPublic: false,
  tags: ['ops', 'audit'],
  version: 1,
  executionCount: 0,
  createdAt: '2026-04-29T12:00:00Z',
  updatedAt: '2026-04-29T12:00:00Z',
  user: { id: 'author-1', username: 'admin' },
};

function setupAuth(role: 'admin' | 'user') {
  vi.mocked(useAuth).mockReturnValue({
    user: {
      id: `${role}-1`,
      username: role,
      email: `${role}@example.com`,
      role,
      created_at: '2026-04-29T00:00:00Z',
    },
    isAuthenticated: true,
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

function setupApi() {
  vi.mocked(scriptService.getScript).mockResolvedValue(baseScript);
  vi.mocked(scriptService.getScriptAnalysis).mockResolvedValue(null);
  vi.mocked(scriptService.getSimilarScripts).mockResolvedValue({ similar_scripts: [] });
  vi.mocked(scriptService.getScriptVersions).mockResolvedValue({ versions: [] });
  vi.mocked(scriptService.updateScript).mockResolvedValue({
    success: true,
    script: { ...baseScript, title: 'Updated Script' },
  });
  vi.mocked(categoryService.getCategories).mockResolvedValue({
    categories: [
      { id: 1, name: 'Operations' },
      { id: 2, name: 'Security' },
    ],
  });
}

async function renderScriptDetail(role: 'admin' | 'user' = 'admin') {
  setupAuth(role);
  setupApi();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/scripts/42']}>
        <Routes>
          <Route path="/scripts/:id" element={<ScriptDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );

  await screen.findByText('Original Script');
}

describe('ScriptDetail admin details editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Edit Details to admins', async () => {
    await renderScriptDetail('admin');

    expect(screen.getByRole('button', { name: /edit details/i })).toBeInTheDocument();
  });

  it('hides Edit Details from non-admin users', async () => {
    await renderScriptDetail('user');

    expect(screen.queryByRole('button', { name: /edit details/i })).not.toBeInTheDocument();
  });

  it('submits script metadata, visibility, tags, and content updates', async () => {
    const user = userEvent.setup();
    await renderScriptDetail('admin');

    await user.click(screen.getByRole('button', { name: /edit details/i }));
    await screen.findByRole('heading', { name: /edit script details/i });

    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), 'Updated Script');
    await user.clear(screen.getByLabelText(/description/i));
    await user.type(screen.getByLabelText(/description/i), 'Updated description');
    await user.selectOptions(screen.getByLabelText(/category/i), '2');
    await user.click(screen.getByLabelText(/public script/i));
    await user.clear(screen.getByLabelText(/tags/i));
    await user.type(screen.getByLabelText(/tags/i), 'security, audit');
    await user.clear(screen.getByLabelText(/script content/i));
    await user.type(screen.getByLabelText(/script content/i), 'Get-Service');
    await user.click(screen.getByRole('button', { name: /save details/i }));

    await waitFor(() => expect(scriptService.updateScript).toHaveBeenCalledWith('42', {
      title: 'Updated Script',
      description: 'Updated description',
      categoryId: 2,
      isPublic: true,
      tags: ['security', 'audit'],
      content: 'Get-Service',
    }));
  });
});
