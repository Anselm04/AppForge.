import { vi } from 'vitest';

export const mockApiResponse = {
  success: true,
  data: { id: 'test-id', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
};

export const mockAuthContext = {
  user: { id: 'test-user-id', email: 'test@example.com', username: 'testuser' },
  isLoading: false,
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  verifyEmail: vi.fn(),
};

export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
};

export const mockNavigate = vi.fn();

export const mockLocation = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default',
};

export const mockQueryClient = {
  query: vi.fn(),
  mutate: vi.fn(),
  invalidateQueries: vi.fn(),
  refetchQueries: vi.fn(),
  resetQueries: vi.fn(),
  setQueryData: vi.fn(),
  getQueryData: vi.fn(),
};

export function clearAllMocks() {
  vi.clearAllMocks();
  mockToast.success.mockClear();
  mockToast.error.mockClear();
  mockNavigate.mockClear();
}

export function resetAllMocks() {
  vi.resetAllMocks();
}

export function restoreAllMocks() {
  vi.restoreAllMocks();
}
