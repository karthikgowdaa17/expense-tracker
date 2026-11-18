import { api } from './client';
import type { Category } from '@/types';

export const categoriesApi = {
  list: () => api.get<Category[]>('/api/categories'),
  create: (data: Omit<Category, 'id' | 'user_id' | 'created_at'>) =>
    api.post<Category>('/api/categories', data),
  update: (id: string, data: Partial<Category>) =>
    api.patch<Category>(`/api/categories/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/categories/${id}`),
};