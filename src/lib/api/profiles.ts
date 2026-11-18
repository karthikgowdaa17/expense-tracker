import { api } from './client';
import type { Profile } from '@/types';

export const profilesApi = {
  get: () => api.get<Profile>('/api/profiles'),
  update: (data: Partial<Profile>) => api.patch<Profile>('/api/profiles', data),
};