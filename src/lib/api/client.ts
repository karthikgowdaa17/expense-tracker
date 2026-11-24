import { API_BASE_URL } from './config';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry) {
    // Session may have expired; refresh and retry once
    try {
      await supabase.auth.refreshSession();
      const {
        data: { session: newSession },
      } = await supabase.auth.getSession();
      const newToken = newSession?.access_token;
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return request<T>(path, { ...options, headers }, false);
      }
    } catch {
      if (typeof window !== 'undefined') {
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
