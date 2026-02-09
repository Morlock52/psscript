import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { AuthProvider, useAuth } from '../AuthContext';

// Mock axios with proper typing for Vitest
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    }))
  }
}));

const mockedAxios = axios as unknown as {
  get: Mock;
  post: Mock;
};

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test component that uses the auth hook
const TestComponent = () => {
  const { user, isAuthenticated, isLoading, login, logout, error } = useAuth();

  const handleLogin = async () => {
    try {
      await login('test@test.com', 'password123');
    } catch {
      // Error is handled by AuthContext and exposed via error state
    }
  };

  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'not-loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="user">{user ? user.email : 'no-user'}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <button onClick={handleLogin}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // These unit tests exercise the "auth enabled" behavior by default.
    // In local dev, the repo often runs with VITE_DISABLE_AUTH=true, which would
    // short-circuit the AuthProvider and break these expectations.
    vi.stubGlobal('import.meta.env', {
      ...(import.meta as any).env,
      VITE_DISABLE_AUTH: 'false',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Initial State', () => {
    it('starts with loading state when no token exists', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Initially loading, then transitions to not loading
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });

    it('loads user from token on mount', async () => {
      localStorageMock.getItem.mockReturnValue('valid-token');
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          user: {
            id: '1',
            username: 'testuser',
            email: 'test@test.com',
            role: 'user',
            created_at: '2024-01-01',
          },
        },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
        expect(screen.getByTestId('user')).toHaveTextContent('test@test.com');
      });
    });

    it('clears invalid token on mount', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-token');
      mockedAxios.get.mockRejectedValueOnce(new Error('Invalid token'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('Login', () => {
    it('successfully logs in user', async () => {
      const user = userEvent.setup();
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          token: 'new-token',
          refreshToken: 'refresh-token',
          user: {
            id: '1',
            username: 'testuser',
            email: 'test@test.com',
            role: 'user',
            created_at: '2024-01-01',
          },
        },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
        expect(screen.getByTestId('user')).toHaveTextContent('test@test.com');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'new-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refresh_token', 'refresh-token');
    });

    it('handles login failure with server error', async () => {
      const user = userEvent.setup();
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
      });
    });

    it('handles network error during login', async () => {
      const user = userEvent.setup();
      const networkError = new Error('Network Error');
      (networkError as any).request = {};
      (networkError as any).config = { url: 'http://localhost:4001/api' };
      mockedAxios.post.mockRejectedValueOnce(networkError);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).not.toHaveTextContent('no-error');
      });
    });
  });

  describe('Logout', () => {
    it('clears user and tokens on logout', async () => {
      const user = userEvent.setup();
      localStorageMock.getItem.mockReturnValue('valid-token');
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          user: {
            id: '1',
            username: 'testuser',
            email: 'test@test.com',
            role: 'user',
            created_at: '2024-01-01',
          },
        },
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      });

      await user.click(screen.getByText('Logout'));

      expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refresh_token');
    });
  });
});
