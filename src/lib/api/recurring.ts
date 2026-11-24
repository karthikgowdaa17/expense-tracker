import { api } from './client';
import type { RecurringTransaction } from '@/types';

export const recurringApi = {
  list: () => api.get<RecurringTransaction[]>('/api/recurring'),
  create: (data: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at' | 'updated_at'>) =>
    api.post<RecurringTransaction>('/api/recurring', data),
  update: (id: string, data: Partial<RecurringTransaction>) =>
    api.patch<RecurringTransaction>(`/api/recurring/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/recurring/${id}`),
  toggle: (id: string) => api.post<RecurringTransaction>('/api/recurring/toggle', { id }),
  generate: () => api.post<{ generated: number; transactions: RecurringTransaction[] }>('/api/recurring/generate', {}),
};