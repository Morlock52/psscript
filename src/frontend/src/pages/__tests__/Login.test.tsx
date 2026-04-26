import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login';

const authMocks = vi.hoisted(() => ({
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  defaultLogin: vi.fn(),
}));

const supabaseState = vi.hoisted(() => ({
  enabled: true,
  missing: false,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: authMocks.login,
    loginWithGoogle: authMocks.loginWithGoogle,
    defaultLogin: authMocks.defaultLogin,
    error: null,
    isLoading: false,
  }),
}));

vi.mock('../../services/supabase', () => ({
  isHostedAuthConfigurationMissing: () => supabaseState.missing,
  isSupabaseAuthEnabled: () => supabaseState.enabled,
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseState.enabled = true;
    supabaseState.missing = false;
  });

  it('renders Google OAuth in hosted Supabase mode', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('passes the attempted route into Google OAuth', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/scripts' } } }]}>
        <Login />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /continue with google/i }));

    expect(authMocks.loginWithGoogle).toHaveBeenCalledWith('/scripts');
  });

  it('hides Google OAuth when Supabase auth is not configured', () => {
    supabaseState.enabled = false;

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
  });
});
