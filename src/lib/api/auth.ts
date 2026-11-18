export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthUser {
  id: string;
  email: string;
  email_verified: boolean;
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    currency: string;
    theme: string;
    financial_year_start_month: number;
    created_at: string;
    updated_at: string;
  } | null;
}

const TOKEN_KEY = 'expense_tracker_auth_tokens';
const USER_KEY = 'expense_tracker_auth_user';

export function getStoredTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(TOKEN_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setAuthData(tokens: AuthTokens, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Also set cookie for middleware
  document.cookie = `access_token=${tokens.access_token}; path=/; max-age=${tokens.expires_in}; SameSite=Lax`;
}

export function clearAuthData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Clear cookie
  document.cookie = 'access_token=; path=/; max-age=0; SameSite=Lax';
}

export function getAccessToken(): string | null {
  const tokens = getStoredTokens();
  return tokens?.access_token ?? null;
}

export function getRefreshToken(): string | null {
  const tokens = getStoredTokens();
  return tokens?.refresh_token ?? null;
}

export function isTokenExpired(expiresIn: number, issuedAt?: number): boolean {
  const issued = issuedAt ?? Date.now();
  return Date.now() > issued + expiresIn * 1000 - 30000; // 30s buffer
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export async function forgotPassword(email: string): Promise<{ message: string; dev_token?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return response.json();
}

export async function resetPassword(token: string, password: string, confirmPassword: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, confirm_password: confirmPassword }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return response.json();
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return response.json();
}

export async function resendVerification(email: string): Promise<{ message: string; dev_token?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }

  return response.json();
}