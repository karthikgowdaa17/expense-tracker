import { api } from './client';
import type { UserSettings } from '@/types';

export const settingsApi = {
  get: () => api.get<UserSettings>('/api/settings'),
  upsert: (data: Partial<UserSettings>) => api.post<UserSettings>('/api/settings', data),
};