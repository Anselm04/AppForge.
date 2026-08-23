import { createElement } from 'react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../useAuth';

const mockApi = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
vi.mock('@/lib/api', () => ({ api: mockApi }));

const mockToast = { success: vi.fn(), error: vi.fn() };
vi.mock('react-hot-toast', () => ({ toast: mockToast }));

function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useAuth Hook', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Initial State', () => {
    it('returns initial state', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('login');
      expect(result.current).toHaveProperty('logout');
      expect(result.current).toHaveProperty('register');
    });
  });

  describe('Login', () => {
    it('calls login API with credentials', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      mockApi.post.mockResolvedValueOnce({ data: { user: { id: '1', email: 'test@example.com' }, token: 'test-token' } });
      await result.current.login({ email: 'test@example.com', password: 'password' });
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', { email: 'test@example.com', password: 'password' });
    });

    it('sets user on successful login', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      const mockUser = { id: '1', email: 'test@example.com' };
      mockApi.post.mockResolvedValueOnce({ data: { user: mockUser, token: 'test-token' } });
      await result.current.login({ email: 'test@example.com', password: 'password' });
      await waitFor(() => expect(result.current.user).toEqual(mockUser));
    });

    it('calls toast.error on failed login', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      mockApi.post.mockRejectedValueOnce(new Error('Invalid credentials'));
      await result.current.login({ email: 'test@example.com', password: 'wrong' });
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  describe('Register', () => {
    it('calls register API with user data', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      mockApi.post.mockResolvedValueOnce({ data: { user: { id: '1', email: 'test@example.com' }, token: 'test-token' } });
      await result.current.register({ email: 'test@example.com', password: 'password', username: 'testuser' });
      expect(mockApi.post).toHaveBeenCalledWith('/auth/register', { email: 'test@example.com', password: 'password', username: 'testuser' });
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when user is logged out', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});
