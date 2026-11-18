import { api } from './client';
import type { Budget } from '@/types';

export const budgetsApi = {
  list: (month?: string) => {
    const qs = month ? `?month=${month}` : '';
    return api.get<Budget[]>(`/api/budgets${qs}`);
  },
  create: (data: Omit<Budget, 'id' | 'user_id' | 'created_at' | 'updated_at'>) =>
    api.post<Budget>('/api/budgets', data),
  update: (id: string, data: Partial<Budget>) =>
    api.patch<Budget>(`/api/budgets/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/budgets/${id}`),
};