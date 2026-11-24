import { API_BASE_URL } from './config';
import { getAccessToken, getRefreshToken, setAuthData, clearAuthData, getStoredUser } from './auth';

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function refreshAccessTokenOnce(): Promise<void> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    isRefreshing = false;
    throw new Error('No refresh token');
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const newTokens = await response.json();
      const currentUser = getStoredUser();
      if (currentUser) {
        setAuthData(newTokens, currentUser);
      }
    } catch {
      clearAuthData();
      throw new Error('Session expired');
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry) {
    // Try to refresh the token
    try {
      await refreshAccessTokenOnce();
      // Retry the request once with new token
      return request<T>(path, options, false);
    } catch {
      // Refresh failed, clear auth and redirect to login
      if (typeof window !== 'undefined') {
        clearAuthData();
        window.location.href = '/auth/login';
      }
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};