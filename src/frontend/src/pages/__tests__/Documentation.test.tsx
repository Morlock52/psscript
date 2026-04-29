import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Documentation from '../Documentation';
import documentationApi, { normalizeDocItem } from '../../services/documentationApi';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/documentationApi', async () => {
  const actual = await vi.importActual<typeof import('../../services/documentationApi')>('../../services/documentationApi');
  return {
    ...actual,
    default: {
      getRecentDocumentation: vi.fn(),
      getSources: vi.fn(),
      getTags: vi.fn(),
      getStats: vi.fn(),
      searchDocumentation: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const { useAuth } = await import('../../contexts/AuthContext');

const baseDoc = {
  id: 101,
  title: 'Existing Manual Doc',
  url: '',
  content: 'Existing content',
  source: 'manual',
  crawledAt: '2026-04-29T12:00:00Z',
  tags: ['existing'],
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
  vi.mocked(documentationApi.getRecentDocumentation).mockResolvedValue([baseDoc]);
  vi.mocked(documentationApi.getSources).mockResolvedValue(['manual']);
  vi.mocked(documentationApi.getTags).mockResolvedValue(['existing']);
  vi.mocked(documentationApi.getStats).mockResolvedValue({ total: 1, sources: {}, tagsCount: 1, lastCrawled: null });
  vi.mocked(documentationApi.upsert).mockResolvedValue({
    id: 202,
    title: 'Created Manual Doc',
    url: '',
    content: 'Created content',
    source: 'manual',
    crawledAt: '2026-04-29T13:00:00Z',
    tags: ['manual'],
  });
  vi.mocked(documentationApi.update).mockResolvedValue({
    ...baseDoc,
    title: 'Edited Manual Doc',
    content: 'Edited content',
    tags: ['edited'],
  });
}

async function renderDocumentation(role: 'admin' | 'user' = 'admin') {
  setupAuth(role);
  setupApi();
  render(
    <MemoryRouter>
      <Documentation />
    </MemoryRouter>
  );
  await screen.findByText('Existing Manual Doc');
}

describe('Documentation manual tile management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows manual create and edit controls for admins', async () => {
    await renderDocumentation('admin');

    expect(screen.getByRole('button', { name: /add documentation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit existing manual doc/i })).toBeInTheDocument();
  });

  it('hides manual create and edit controls for non-admin users', async () => {
    await renderDocumentation('user');

    expect(screen.queryByRole('button', { name: /add documentation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit existing manual doc/i })).not.toBeInTheDocument();
  });

  it('validates required manual documentation fields', async () => {
    const user = userEvent.setup();
    await renderDocumentation('admin');

    await user.click(screen.getByRole('button', { name: /add documentation/i }));
    await user.click(screen.getByRole('button', { name: /save documentation/i }));

    expect(await screen.findByText('Title is required.')).toBeInTheDocument();
    expect(documentationApi.upsert).not.toHaveBeenCalled();
  });

  it('adds a created manual documentation tile without reloading', async () => {
    const user = userEvent.setup();
    await renderDocumentation('admin');

    await user.click(screen.getByRole('button', { name: /add documentation/i }));
    await user.type(screen.getByLabelText(/title/i), 'Created Manual Doc');
    await user.type(screen.getByLabelText(/markdown content/i), 'Created content');
    await user.type(screen.getByLabelText(/tags/i), 'manual');
    await user.click(screen.getByRole('button', { name: /save documentation/i }));

    await waitFor(() => expect(documentationApi.upsert).toHaveBeenCalledWith({
      title: 'Created Manual Doc',
      url: '',
      source: 'manual',
      content: 'Created content',
      tags: ['manual'],
    }));
    expect(await screen.findByText('Created Manual Doc')).toBeInTheDocument();
  });

  it('edits an existing manual documentation tile without reloading', async () => {
    const user = userEvent.setup();
    await renderDocumentation('admin');

    await user.click(screen.getByRole('button', { name: /edit existing manual doc/i }));
    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), 'Edited Manual Doc');
    await user.click(screen.getByRole('button', { name: /save documentation/i }));

    await waitFor(() => expect(documentationApi.update).toHaveBeenCalledWith(101, expect.objectContaining({
      title: 'Edited Manual Doc',
      content: 'Existing content',
    })));
    expect(await screen.findByText('Edited Manual Doc')).toBeInTheDocument();
  });

  it('normalizes hosted snake_case documentation rows', () => {
    expect(normalizeDocItem({
      id: 303,
      title: 'Hosted Row',
      url: null as unknown as string,
      content: 'Hosted content',
      source: null as unknown as string,
      tags: null as unknown as string[],
      created_at: '2026-04-29T14:00:00Z',
      updated_at: '2026-04-29T15:00:00Z',
    }).crawledAt).toBe('2026-04-29T15:00:00Z');
  });
});
