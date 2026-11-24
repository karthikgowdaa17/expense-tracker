'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { getStoredTokens, getStoredUser, setAuthData, clearAuthData, getRefreshToken, resendVerification } from '@/lib/api/auth';
import type { AuthTokens, AuthUser } from '@/lib/api/auth';

interface AuthContextType {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAccessToken = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const newTokens: AuthTokens = await response.json();
      const currentUser = getStoredUser();
      if (currentUser) {
        setAuthData(newTokens, currentUser);
        setTokens(newTokens);
      }
    } catch {
      clearAuthData();
      setUser(null);
      setTokens(null);
      throw new Error('Session expired');
    }
  }, []);

  const fetchUser = useCallback(async () => {
    const storedTokens = getStoredTokens();
    const storedUser = getStoredUser();

    if (storedTokens && storedUser) {
      setTokens(storedTokens);
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }

    const data = await response.json();
    setAuthData(data, data.user);
    setTokens(data);
    setUser(data.user);
  };

  const signup = async (email: string, password: string, fullName?: string) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Signup failed' }));
      throw new Error(err.error || 'Signup failed');
    }

    const data = await response.json();
    setAuthData(data, data.user);
    setTokens(data);
    setUser(data.user);
  };

  const handleResendVerification = async (email: string) => {
    await resendVerification(email);
  };

  const logout = async () => {
    clearAuthData();
    setUser(null);
    setTokens(null);
  };

  return (
    <AuthContext.Provider value={{ user, tokens, loading, login, signup, logout, refreshAccessToken, resendVerification: handleResendVerification, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}